// File: src/lib/stores/connection.js
// Project: tabletop-client
// Purpose: Manages WebSocket connections and state for the tabletop game

import { writable } from './custom/writable.js';
import { io } from 'socket.io-client';
import { browser } from '$app/environment';

// Connection state management
export const room = writable(null);
export const connected = writable(false);
export const chat = writable([]);

// Socket.io instance
let socket;

// Connection URLs from environment variables with fallbacks
const primaryServer = browser && import.meta.env.VITE_PVP_SERVER 
  ? import.meta.env.VITE_PVP_SERVER 
  : 'https://tabletop-server.jasonh1993.workers.dev';

const fallbackServer = browser && import.meta.env.VITE_PVP_SERVER_CLOUDFLARE 
  ? import.meta.env.VITE_PVP_SERVER_CLOUDFLARE 
  : 'https://tabletop-server.jasonh1993.workers.dev';

// Initialize socket and connections
function initializeSocket() {
  if (!browser) return; // Early exit if not in browser environment
  
  let currentServer = primaryServer;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  
  function setupSocket(serverUrl) {
    try {
      console.log(`Attempting connection to: ${serverUrl}`);
      
      // Clear existing socket if present
      if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
      }
      
      // Create new socket instance with optimized options
      socket = io(serverUrl, {
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 5000,
        forceNew: true,
        autoConnect: false
      });
      
      // Connection event handlers
      socket.on('connect', () => {
        console.log('WebSocket connected successfully');
        connected.set(true);
        retryCount = 0;
        
        // Rejoin room if previously in one
        const currentRoom = room.get();
        if (currentRoom) {
          joinRoom(currentRoom);
        }
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`WebSocket disconnected: ${reason}`);
        connected.set(false);
      });
      
      socket.on('connect_error', (error) => {
        console.error(`Connection error: ${error.message}`);
        connected.set(false);
        
        // Try fallback if using primary, or retry with exponential backoff
        if (serverUrl === primaryServer && retryCount === 0) {
          console.log('Switching to fallback server');
          currentServer = fallbackServer;
          setupSocket(fallbackServer);
        } else if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(1000 * (2 ** retryCount), 10000);
          console.log(`Retrying connection in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          setTimeout(() => socket.connect(), delay);
        }
      });
      
      // Game-specific events
      socket.on('createdRoom', (data) => {
        room.set(data.roomId);
      });
      
      socket.on('joinedRoom', (data) => {
        room.set(data.roomId);
      });
      
      socket.on('leftRoom', () => {
        room.set(null);
        chat.set([]);
      });
      
      socket.on('chatMessage', (data) => {
        chat.update(msgs => [...msgs, data]);
      });
      
      // Attempt initial connection
      socket.connect();
      
    } catch (error) {
      console.error(`Socket initialization error: ${error.message}`);
      
      // Try fallback if using primary
      if (serverUrl === primaryServer) {
        console.log('Falling back to secondary server due to initialization error');
        setupSocket(fallbackServer);
      }
    }
  }
  
  // Start with primary server
  setupSocket(currentServer);
}

// Only initialize in browser environment
if (browser) {
  initializeSocket();
}

// Connection management functions
function connect() {
  if (browser && socket && !connected.get()) {
    socket.connect();
  }
}

function createRoom() {
  connect();
  socket?.emit('createRoom');
}

function joinRoom(roomId) {
  connect();
  socket?.emit('joinRoom', { roomId });
}

function leaveRoom() {
  if (socket && room.get()) {
    socket.emit('leaveRoom', { roomId: room.get() });
    room.set(null);
    chat.set([]);
  }
}

function publishToChat(message, type = 'chat') {
  if (socket && room.get()) {
    socket.emit('chatMessage', { 
      roomId: room.get(), 
      message, 
      type,
      time: new Date().toISOString(),
      self: true
    });
  }
}

function publishLog(log) {
  if (socket && room.get()) {
    socket.emit('logMessage', { roomId: room.get(), log });
    // Also add to local chat for immediate feedback
    chat.update(msgs => [...msgs, { 
      message: log, 
      time: new Date().toISOString(),
      type: 'important',
      self: true
    }]);
  }
}

function share(event, data) {
  if (socket && room.get()) {
    socket.emit(event, { 
      roomId: room.get(), 
      ...data 
    });
  }
}

export { 
  socket, 
  connect, 
  createRoom, 
  joinRoom, 
  leaveRoom, 
  publishToChat, 
  publishLog, 
  share 
};

// Helper function for code organization
export function react(event, callback) {
  if (browser && socket) {
    socket.on(event, callback);
  }
}