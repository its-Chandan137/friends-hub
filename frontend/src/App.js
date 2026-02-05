import React, { useEffect, useState } from 'react';
import { connectSocket, getSocket } from './socket';
import Dashboard from './components/Dashboard/Dashboard';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    socket.on('connect', () => {
      console.log('Socket connected!');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLoginAndConnect = async () => {
    try {
      // 1️⃣ Call login API
      const response = await fetch(
        'http://localhost:5000/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'chandan@example.com',
            password: 'LittleDemon137',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.token) {
        setUser(data.user);
        setIsLoggedIn(true);
      }

      // 2️⃣ Extract token
      const { token, user } = data;
      console.log('Login success:', user);

      // 3️⃣ Connect socket with token
      connectSocket(token);
      const socket = getSocket();

      // 4️⃣ Socket listeners (aligned with backend)
      socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
      });

      socket.on('welcome', (payload) => {
        console.log('🎉 Server says:', payload.message);
      });

      socket.on('connect_error', (err) => {
        console.error('❌ Socket auth failed:', err.message);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
      });

    } catch (err) {
      console.error('❌ Login / Socket error:', err.message);
    }
  };


  return (
    <div className="App">
      <h1>Friends Hub – Welcome, Chandan!</h1>
      <p>Check console for socket connection</p>

      {!isLoggedIn ? (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <h1>Friends Hub</h1>
          <button onClick={handleLoginAndConnect}>
            Login & Connect Socket
          </button>
        </div>
      ) : (
        <Dashboard user={user} />
      )}


    </div>
  );
}

export default App;
