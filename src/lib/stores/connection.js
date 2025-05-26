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
  let connectionAttempts = 0;
  
  function setupSocket(serverUrl) {
    try {
      console.log(`Attempting connection to: ${serverUrl}`);
      connectionAttempts++;
      
      // Clear existing socket if present
      if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
      }
      
      // Create new socket instance with optimized options for Cloudflare Worker
      socket = io(serverUrl, {
        transports: ['polling'], // Start with polling only since Worker doesn't support WebSocket upgrade
        upgrade: false, // Disable WebSocket upgrade
        rememberUpgrade: false,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
        forceNew: true,
        autoConnect: false,
        // Engine.IO options
        timestampRequests: true,
        timestampParam: 't'
      });
      
      // Connection event handlers
      socket.on('connect', () => {
        console.log('Socket.IO connected successfully to:', serverUrl);
        connected.set(true);
        retryCount = 0;
        connectionAttempts = 0;
        
        // Rejoin room if previously in one
        const currentRoom = room.get();
        if (currentRoom) {
          console.log('Rejoining room:', currentRoom);
          joinRoom(currentRoom);
        }
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`Socket.IO disconnected: ${reason}`);
        connected.set(false);
        
        // Don't auto-reconnect on manual disconnect
        if (reason === 'io client disconnect') {
          return;
        }
      });
      
      socket.on('connect_error', (error) => {
        console.error(`Connection error: ${error.message || error}`);
        connected.set(false);
        
        // Try fallback server if we haven't tried it yet and we're on primary
        if (serverUrl === primaryServer && connectionAttempts === 1) {
          console.log('Switching to fallback server');
          currentServer = fallbackServer;
          setTimeout(() => setupSocket(fallbackServer), 1000);
          return;
        }
        
        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(1000 * (2 ** retryCount), 10000);
          console.log(`Retrying connection in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          setTimeout(() => {
            if (socket) {
              socket.connect();
            }
          }, delay);
        } else {
          console.error('Max connection attempts reached. Please check your network connection.');
        }
      });
      
      // Engine.IO specific events for debugging
      socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
      });
      
      // Game-specific events
      socket.on('createdRoom', (data) => {
        console.log('Room created:', data);
        room.set(data.roomId);
      });
      
      socket.on('joinedRoom', (data) => {
        console.log('Joined room:', data);
        room.set(data.roomId);
      });
      
      socket.on('leftRoom', () => {
        console.log('Left room');
        room.set(null);
        chat.set([]);
      });
      
      socket.on('playerJoined', (data) => {
        console.log('Player joined:', data);
        chat.update(msgs => [...msgs, {
          message: `Player ${data.sessionId} joined the room`,
          time: new Date().toISOString(),
          type: 'system'
        }]);
      });
      
      socket.on('playerLeft', (data) => {
        console.log('Player left:', data);
        chat.update(msgs => [...msgs, {
          message: `Player ${data.sessionId} left the room`,
          time: new Date().toISOString(),
          type: 'system'
        }]);
      });
      
      socket.on('chatMessage', (data) => {
        console.log('Chat message received:', data);
        chat.update(msgs => [...msgs, data]);
      });
      
      socket.on('logMessage', (data) => {
        console.log('Log message received:', data);
        chat.update(msgs => [...msgs, {
          message: data.log,
          time: data.time,
          type: 'important',
          from: data.from
        }]);
      });
      
      // Attempt initial connection
      socket.connect();
      
    } catch (error) {
      console.error(`Socket initialization error: ${error.message}`);
      
      // Try fallback if using primary
      if (serverUrl === primaryServer && connectionAttempts === 1) {
        console.log('Falling back to secondary server due to initialization error');
        setTimeout(() => setupSocket(fallbackServer), 1000);
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
    console.log('Manually connecting socket...');
    socket.connect();
  }
}

function disconnect() {
  if (socket && connected.get()) {
    console.log('Manually disconnecting socket...');
    socket.disconnect();
  }
}

function createRoom() {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }
  
  if (!connected.get()) {
    console.log('Not connected, attempting to connect first...');
    connect();
    // Wait for connection before creating room
    const unsubscribe = connected.subscribe(isConnected => {
      if (isConnected) {
        console.log('Connected, now creating room...');
        socket.emit('createRoom');
        unsubscribe();
      }
    });
    return;
  }
  
  console.log('Creating room...');
  socket.emit('createRoom');
}

function joinRoom(roomId) {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }
  
  if (!connected.get()) {
    console.log('Not connected, attempting to connect first...');
    connect();
    // Wait for connection before joining room
    const unsubscribe = connected.subscribe(isConnected => {
      if (isConnected) {
        console.log('Connected, now joining room:', roomId);
        socket.emit('joinRoom', { roomId });
        unsubscribe();
      }
    });
    return;
  }
  
  console.log('Joining room:', roomId);
  socket.emit('joinRoom', { roomId });
}

function leaveRoom() {
  if (socket && room.get()) {
    console.log('Leaving room:', room.get());
    socket.emit('leaveRoom', { roomId: room.get() });
    room.set(null);
    chat.set([]);
  }
}

function publishToChat(message, type = 'chat') {
  if (socket && room.get()) {
    console.log('Publishing chat message:', message);
    socket.emit('chatMessage', { 
      roomId: room.get(), 
      message, 
      type,
      time: new Date().toISOString(),
      self: true
    });
    
    // Add to local chat immediately for better UX
    chat.update(msgs => [...msgs, { 
      message, 
      time: new Date().toISOString(),
      type,
      self: true,
      from: 'You'
    }]);
  }
}

function publishLog(log) {
  if (socket && room.get()) {
    console.log('Publishing log message:', log);
    socket.emit('logMessage', { roomId: room.get(), log });
    
    // Also add to local chat for immediate feedback
    chat.update(msgs => [...msgs, { 
      message: log, 
      time: new Date().toISOString(),
      type: 'important',
      self: true,
      from: 'You'
    }]);
  }
}

function share(event, data) {
  if (socket && room.get()) {
    console.log('Sharing event:', event, data);
    socket.emit(event, { 
      roomId: room.get(), 
      ...data 
    });
  }
}

export { 
  socket, 
  connect, 
  disconnect,
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