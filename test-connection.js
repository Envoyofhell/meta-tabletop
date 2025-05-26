// Simple test script to verify Socket.IO connection
import { io } from 'socket.io-client';

console.log('Testing Socket.IO connection to http://localhost:8787');

const socket = io('http://localhost:8787', {
  transports: ['polling', 'websocket'],
  timeout: 5000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Connected successfully!');
  console.log('Socket ID:', socket.id);
  
  // Test creating a room
  socket.emit('createRoom');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('createdRoom', (data) => {
  console.log('🏠 Room created:', data);
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timed out');
  process.exit(1);
}, 10000); 