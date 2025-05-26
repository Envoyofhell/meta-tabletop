// Simple test script to verify Socket.IO connection
import { io } from 'socket.io-client';

console.log('Testing Socket.IO connection to https://socketio-test-worker.jasonh1993.workers.dev');

const socket = io('https://socketio-test-worker.jasonh1993.workers.dev', {
  transports: ['polling'], // Use polling only for Cloudflare Worker
  upgrade: false,
  timeout: 10000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Connected successfully!');
  console.log('Socket ID:', socket.id);
  
  // Test creating a room
  console.log('🏠 Creating room...');
  socket.emit('createRoom');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message || error);
});

socket.on('createdRoom', (data) => {
  console.log('🏠 Room created successfully:', data);
  
  // Test sending a chat message
  console.log('💬 Sending chat message...');
  socket.emit('chatMessage', { 
    roomId: data.roomId, 
    message: 'Hello from test!',
    type: 'chat'
  });
  
  setTimeout(() => {
    console.log('✅ Test completed successfully!');
    process.exit(0);
  }, 2000);
});

socket.on('chatMessage', (data) => {
  console.log('💬 Chat message received:', data);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.log('⏰ Test timed out');
  process.exit(1);
}, 15000); 