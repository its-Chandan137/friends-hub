import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

let socket = null;

export const connectSocket = (token) => {
  if (socket) socket.disconnect();


  socket = io(SOCKET_URL, {
    auth: { token }, // send JWT here
    autoConnect: false,
  });

  socket.connect();

  socket.on('welcome', (data) => {
    console.log('Welcome from server:', data);
  });

  return socket;
};

export const getSocket = () => socket;