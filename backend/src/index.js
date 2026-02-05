require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const Item = require('./models/Item');
const User = require('./models/User');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
const authMiddleware = require('./middleware/auth');

// Protected test route
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({
    message: 'You are authenticated!',
    user: req.user,
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

// Basic route to test
app.get('/', (req, res) => res.send('Friends Hub Backend Running!'));

io.use((socket, next) => {
  const token = socket.handshake.auth.token; // client will send token in auth object

  if (!token) {
    return next(new Error('Authentication error: no token'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // attach user to socket
    next();
  } catch (err) {
    next(new Error('Authentication error: invalid token'));
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'User:', socket.user?.username || 'unauthenticated');

  // Example: send welcome with user info
  socket.emit('welcome', { message: `Welcome ${socket.user?.username || 'guest'}!` });

  ////////////////////lockRow event here////////////////////////////////////////
  socket.on('lockRow', async ({ itemId }) => {
    try {
      const item = await Item.findById(itemId);
      if (!item) return socket.emit('error', { message: 'Item not found' });

      if (item.status === 'Updating') {
        return socket.emit('error', { message: 'Row is already being updated' });
      }

      item.status = 'Updating';
      item.lockedBy = socket.user.id;
      item.lockedAt = new Date();
      await item.save();

      // Broadcast to all
      io.emit('rowUpdate', {
        itemId: item._id,
        status: item.status,
        lockedBy: socket.user.id,
        lockedByUsername: socket.user.username,
      });

      socket.emit('lockSuccess', { itemId });
    } catch (err) {
      socket.emit('error', { message: 'Lock failed' });
    }
  });

  ////////////////////unlockRow event here////////////////////////////////////////
  socket.on('unlockRow', async ({ itemId, newData }) => {
    try {
      const item = await Item.findById(itemId);
      if (!item || item.lockedBy.toString() !== socket.user.id) {
        return socket.emit('error', { message: 'Not authorized or not locked' });
      }

      if (newData) {
        item.data = { ...item.data, ...newData };
        item.updatedBy = socket.user.id;
        item.updatedAt = new Date();
      }

      item.status = 'Updated';
      item.lockedBy = null;
      item.lockedAt = null;
      await item.save();

      io.emit('rowUpdate', {
        itemId: item._id,
        status: item.status,
        data: item.data,
        updatedBy: socket.user.username,
      });

      socket.emit('unlockSuccess', { itemId });
    } catch (err) {
      socket.emit('error', { message: 'Unlock failed' });
    }
  });

  ///////////////////// Also allow fetching current items (for initial load)/////////////////////////////////////
  socket.on('getMeals', async () => {
    const meals = await Item.find({ section: 'meals' }).populate('createdBy', 'username');
    socket.emit('mealsData', meals);
  });

  // ///////// Create Meal Event Here //////////////////////////////////////
  socket.on('createMeal', async ({ data }) => {
    try {
      const newItem = new Item({
        section: 'meals',
        data,
        status: 'Updating',
        lockedBy: socket.user.id,
        createdBy: socket.user.id,
      });
      await newItem.save();

      io.emit('rowUpdate', {
        itemId: newItem._id,
        status: newItem.status,
        data: newItem.data,
        createdBy: socket.user.username,
      });

      socket.emit('createSuccess', { itemId: newItem._id });
    } catch (err) {
      socket.emit('error', { message: 'Create failed' });
    }
  });

  //////////// On Disconnect //////////////////////////////////////
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});