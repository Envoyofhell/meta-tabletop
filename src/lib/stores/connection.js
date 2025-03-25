// File: meta-tabletop/src/lib/stores/connection.js
// Project: CLIENT
// Purpose: Svelte stores for managing connection state

import { writable, derived } from 'svelte/store';
import * as api from '$lib/api';

// Store for current room ID
export const room = writable('');

// Store for connection status
export const connected = writable(false);

// Store for chat messages
export const chat = writable([]);

// Store for WebSocket connection
const socket = writable(null);

// Store for connection errors
export const connectionError = writable(null);

/**
 * Create a new room and connect to it
 */
export async function createRoom() {
  try {
    connectionError.set(null);
    
    // Create room via API
    const roomId = await api.createRoom();
    room.set(roomId);
    
    // Establish WebSocket connection
    connectToSocket(roomId);
    
    return roomId;
  } catch (error) {
    connectionError.set(`Failed to create room: ${error.message}`);
    console.error('Error creating room:', error);
  }
}

/**
 * Join an existing room
 * @param {string} roomId - Room ID to join
 */
export function joinRoom(roomId) {
  if (!roomId) return;
  
  connectionError.set(null);
  room.set(roomId);
  connectToSocket(roomId);
}

/**
 * Connect to WebSocket for a room
 * @param {string} roomId - Room ID to connect to
 */
function connectToSocket(roomId) {
  try {
    // Close existing socket if any
    let currentSocket;
    socket.update(s => {
      currentSocket = s;
      return null;
    });
    
    if (currentSocket) {
      currentSocket.close();
    }
    
    // Create new socket connection
    const newSocket = api.connectToRoom(roomId);
    socket.set(newSocket);
    
    // Setup event listeners
    api.on('connection', handleConnectionStatus);
    api.on('chatMessage', handleChatMessage);
    api.on('opponentJoined', handleOpponentJoined);
    api.on('opponentLeft', handleOpponentLeft);
  } catch (error) {
    connectionError.set(`Failed to connect: ${error.message}`);
    console.error('Error connecting to socket:', error);
  }
}

/**
 * Handle connection status changes
 * @param {object} status - Connection status object
 */
function handleConnectionStatus(status) {
  connected.set(status.status === 'connected');
  
  if (status.status === 'error') {
    connectionError.set(`Connection error: ${status.error}`);
  } else if (status.status === 'disconnected') {
    // Auto-reconnect if disconnected unexpectedly
    if (status.code !== 1000 && status.code !== 1001) {
      let roomId;
      room.subscribe(r => roomId = r)();
      
      if (roomId) {
        console.log('Attempting to reconnect...');
        setTimeout(() => connectToSocket(roomId), 2000);
      }
    }
  }
}

/**
 * Handle incoming chat messages
 * @param {object} message - Chat message
 */
function handleChatMessage(message) {
  chat.update(messages => {
    // Don't add duplicates (can happen during reconnection)
    const exists = messages.some(m => 
      m.time === message.time && 
      m.message === message.message && 
      m.self === message.self
    );
    
    if (!exists) {
      return [...messages, message];
    }
    
    return messages;
  });
}

/**
 * Handle opponent joining the room
 */
function handleOpponentJoined() {
  connected.set(true);
  publishToChat('Opponent has joined the room', 'important');
}

/**
 * Handle opponent leaving the room
 */
function handleOpponentLeft() {
  publishToChat('Opponent has left the room', 'important');
}

/**
 * Leave the current room
 */
export function leaveRoom() {
  let currentSocket;
  socket.update(s => {
    currentSocket = s;
    return null;
  });
  
  if (currentSocket) {
    api.leaveRoom(currentSocket);
  }
  
  room.set('');
  connected.set(false);
  chat.set([]);
}

/**
 * Send a chat message
 * @param {string} message - Message text
 * @param {string} type - Message type
 */
export function publishToChat(message, type = 'chat') {
  if (!message) return;
  
  let currentSocket;
  socket.subscribe(s => currentSocket = s)();
  
  if (currentSocket) {
    api.sendChatMessage(currentSocket, message, type);
  }
  
  // Add message to local chat
  chat.update(messages => [
    ...messages, 
    {
      type,
      message,
      time: new Date().toISOString(),
      self: true
    }
  ]);
}

/**
 * Send a game action
 * @param {string} actionType - Type of game action
 * @param {object} data - Action data
 */
export function sendGameAction(actionType, data = {}) {
  let currentSocket;
  socket.subscribe(s => currentSocket = s)();
  
  if (currentSocket) {
    api.sendMessage(currentSocket, {
      type: actionType,
      ...data
    });
  }
}

// Clean up event listeners when module is hot-reloaded (for development)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    api.off('connection', handleConnectionStatus);
    api.off('chatMessage', handleChatMessage);
    api.off('opponentJoined', handleOpponentJoined);
    api.off('opponentLeft', handleOpponentLeft);
  });
}