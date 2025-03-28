import { writable } from './custom/writable.js';
import { io } from 'socket.io-client';

// 1. Environment Variable Retrieval and Validation
const server = import.meta.env.VITE_PVP_SERVER;

if (!server) {
  console.error("VITE_PVP_SERVER environment variable is not defined.");
  // Handle the error appropriately (e.g., display an error message to the user)
}

// 2. WebSocket Connection Setup
export let room = writable(null);
export let connected = writable(false);
export let chat = writable([]);

let socket; // Declare socket variable outside the try-catch block

try {
  console.log("Attempting to connect to WebSocket:", server); // Log the server URL

  socket = io(server, {
    transports: ['websocket'],
    autoConnect: false,
  });

  // 3. Socket.IO Event Handlers
  socket.on('connect', () => {
    console.log("WebSocket connection established.");
    connected.set(true);
    if (room.get()) {
      joinRoom(room.get());
    }
  });

  socket.on('disconnect', (reason) => {
    console.log("WebSocket connection disconnected:", reason);
    connected.set(false);
  });

  socket.on('connect_error', (error) => {
    console.error("WebSocket connection error:", error);
    connected.set(false);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log("WebSocket reconnected after attempt:", attemptNumber);
    connected.set(true);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log("WebSocket reconnect attempt:", attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error("WebSocket reconnect error:", error);
  });

  socket.on('reconnect_failed', () => {
    console.error("WebSocket reconnect failed.");
  });

  // ... (rest of your Socket.IO event handlers: createdRoom, joinedRoom, etc.) ...

  // 4. Helper Functions
  function connect() {
    if (!connected.get()) {
      console.log("Connecting socket...");
      socket.connect();
    }
  }

  // ... (rest of your helper functions: createRoom, joinRoom, leaveRoom, etc.) ...

  // 5. Debugging (Optional)
  if (import.meta.env.VITE_ENV === 'dev') {
    socket.onAny((eventName, ...args) => {
      console.log('Received event ' + eventName, args);
    });
  }

} catch (error) {
  console.error("Error initializing WebSocket connection:", error);
  // Handle the error appropriately (e.g., display an error message to the user)
}

// 6. Export Socket and Functions
export { socket, connect, createRoom, joinRoom, leaveRoom, publishToChat, publishLog, react, share };