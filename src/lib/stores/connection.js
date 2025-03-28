// File: src/lib/stores/connection.js
// Project: meta-tabletop (Client-side)
// Purpose: Manages WebSocket connections using Socket.IO, including fallback logic, error handling, and state management.

import { writable } from './custom/writable.js'; // Assuming you have a custom writable store
import { io } from 'socket.io-client';

// 1. Environment Variable Retrieval and Fallback Setup
const primaryServer = import.meta.env.VITE_PVP_SERVER; // Primary server URL from environment
const fallbackServer = import.meta.env.VITE_PVP_SERVER_CLOUDFLARE || 'wss://tabletop-server.jasonh1993.workers.dev/socket.io'; // Fallback from env, or default

// Validation: Check if the primary server URL is defined
if (!primaryServer) {
  console.error("VITE_PVP_SERVER environment variable is not defined.");
  // Handle the error appropriately (e.g., display an error message to the user)
}

// 2. State Management (Using Svelte's writable stores)
export let room = writable(null); // Current room ID
export let connected = writable(false); // WebSocket connection status
export let chat = writable([]); // Chat messages array

// 3. WebSocket Connection and Event Handlers
let socket; // Declare socket variable outside try-catch for broader scope

// Function to attempt WebSocket connection with a given server URL
function attemptConnection(serverUrl) {
  try {
    console.log("Attempting to connect to WebSocket:", serverUrl); // Log connection attempt

    // Initialize Socket.IO client
    socket = io(serverUrl, {
      transports: ['websocket'], // Prefer WebSocket transport
      autoConnect: false, // Manual connection control
    });

    // Event Handlers (Connection and Disconnection)
    socket.on('connect', () => {
      console.log("WebSocket connection established.");
      connected.set(true); // Update connection status
      if (room.get()) {
        joinRoom(room.get()); // Re-join room if previously joined
      }
    });

    socket.on('disconnect', (reason) => {
      console.log("WebSocket connection disconnected:", reason);
      connected.set(false); // Update connection status
    });

    // Error Handling
    socket.on('connect_error', (error) => {
      console.error("WebSocket connection error:", error);
      connected.set(false); // Update connection status
      if (serverUrl === primaryServer) {
        console.log("Attempting fallback connection...");
        attemptConnection(fallbackServer); // Try fallback if primary fails
      }
    });

    // Reconnection Handlers (Optional, for better resilience)
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

    socket.connect(); // Initiate the connection after setting up event handlers

  } catch (error) {
    console.error("Error initializing WebSocket connection:", error);
    if (serverUrl === primaryServer) {
      console.log("Attempting fallback connection...");
      attemptConnection(fallbackServer); // Try fallback if primary fails
    }
  }
}

// 4. Helper Functions (Room Management, Chat, Game State)

// Connect function, used to manually connect the socket.
function connect() {
    if (!connected.get()) {
        console.log("Connecting socket...");
        socket.connect();
    }
}

function createRoom() {
  connect();
  socket.emit('createRoom');
}

function joinRoom(roomId) {
  connect();
  socket.emit('joinRoom', { roomId });
}

function leaveRoom() {
  socket.emit('leaveRoom', { roomId: room.get() });
  chat.set([]); // Clear chat on leaving room
}

function publishToChat(message) {
  if (socket) {
    socket.emit('chatMessage', { roomId: room.get(), message });
  }
}

function publishLog(log){
  if (socket){
    socket.emit("logMessage", {roomId: room.get(), log});
  }
}

function react(reaction){
  if(socket){
    socket.emit("reaction", {roomId: room.get(), reaction});
  }
}

function share(card){
  if(socket){
    socket.emit("share", {roomId: room.get(), card});
  }
}

// ... (rest of your helper functions: publishLog, react, share) ...

// 5. Debugging (Optional, for development environment)
if (import.meta.env.VITE_ENV === 'dev') {
  socket.onAny((eventName, ...args) => {
    console.log('Received event ' + eventName, args); // Log all events
  });
}

// 6. Initial Connection Attempt
attemptConnection(primaryServer); // Start with the primary server URL

// 7. Export Socket and Functions
export { socket, connect, createRoom, joinRoom, leaveRoom, publishToChat, publishLog, react, share };