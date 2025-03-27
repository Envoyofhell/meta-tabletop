/**
 * File: src/lib/stores/connection.js
 * Project: Meta Tabletop (Pokémon TCG Simulator)
 * Path: src/lib/stores/
 * 
 * Purpose: Manages WebSocket connections between players and stores game state
 * 
 * This module provides:
 * - Connection management to the Cloudflare Worker backend
 * - Real-time synchronization between players
 * - Chat functionality
 * - Game action transmission
 */

import { writable, derived, get } from 'svelte/store';
import * as api from '$lib/api';

// ===============================
// Core Stores
// ===============================

// Store for current room ID
export const room = writable('');

// Store for connection status
export const connected = writable(false);

// Store for chat messages
export const chat = writable([]);

// Store for WebSocket connection
export const socket = writable(null);

// Store for connection errors
export const connectionError = writable(null);

// Event listeners registry - for react() function
const eventListeners = new Map();

// ===============================
// Connection Management
// ===============================

/**
 * Create a new room and connect to it
 * @returns {Promise<string>} Room ID for the created room
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
    throw error; // Re-throw for caller to handle if needed
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
    
    if (currentSocket && currentSocket.readyState !== WebSocket.CLOSED) {
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
      const currentRoom = get(room);
      
      if (currentRoom) {
        console.log('Attempting to reconnect...');
        setTimeout(() => connectToSocket(currentRoom), 2000);
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
  
  // Trigger any registered join event handlers
  triggerEventListeners('opponentJoined');
}

/**
 * Handle opponent leaving the room
 */
function handleOpponentLeft() {
  publishToChat('Opponent has left the room', 'important');
  
  // Trigger any registered leave event handlers
  triggerEventListeners('opponentLeft');
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
  
  // Trigger the leftRoom event
  triggerEventListeners('leftRoom');
}

// ===============================
// Communication
// ===============================

/**
 * Send a chat message
 * @param {string} message - Message text
 * @param {string} type - Message type ('chat', 'important', 'log')
 */
export function publishToChat(message, type = 'chat') {
  if (!message) return;
  
  const currentSocket = get(socket);
  
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
 * Send a log message (for game actions)
 * This is functionally the same as publishToChat but with type='log'
 * @param {string} message - Log message
 */
export function publishLog(message) {
  publishToChat(message, 'log');
}

/**
 * Share game state or action with opponent
 * @param {string} actionType - Type of game action
 * @param {object} data - Action data
 */
export function share(actionType, data = {}) {
  const currentSocket = get(socket);
  
  if (currentSocket) {
    api.sendMessage(currentSocket, {
      type: actionType,
      ...data
    });
  }
}

/**
 * Register an event handler for a specific event
 * @param {string} event - Event name
 * @param {Function} handler - Event handler function
 */
export function react(event, handler) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, []);
  }
  
  eventListeners.get(event).push(handler);
}

/**
 * Trigger all handlers for a specific event
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function triggerEventListeners(event, data) {
  if (!eventListeners.has(event)) return;
  
  for (const handler of eventListeners.get(event)) {
    try {
      handler(data);
    } catch (error) {
      console.error(`Error in event handler for ${event}:`, error);
    }
  }
}

// Register listeners for game actions
api.on('joinedRoom', (data) => triggerEventListeners('joinedRoom', data));
api.on('boardReset', (data) => triggerEventListeners('boardReset', data));
api.on('cardsMoved', (data) => triggerEventListeners('cardsMoved', data));
api.on('slotsMoved', (data) => triggerEventListeners('slotsMoved', data));
api.on('cardsBenched', (data) => triggerEventListeners('cardsBenched', data));
api.on('activeBenched', (data) => triggerEventListeners('activeBenched', data));
api.on('cardPromoted', (data) => triggerEventListeners('cardPromoted', data));
api.on('slotPromoted', (data) => triggerEventListeners('slotPromoted', data));
api.on('cardsEvolved', (data) => triggerEventListeners('cardsEvolved', data));
api.on('cardsAttached', (data) => triggerEventListeners('cardsAttached', data));
api.on('damageUpdated', (data) => triggerEventListeners('damageUpdated', data));
api.on('oppDamageUpdated', (data) => triggerEventListeners('oppDamageUpdated', data));
api.on('markerUpdated', (data) => triggerEventListeners('markerUpdated', data));
api.on('slotDiscarded', (data) => triggerEventListeners('slotDiscarded', data));
api.on('stadiumPlayed', (data) => triggerEventListeners('stadiumPlayed', data));
api.on('pokemonToggle', (data) => triggerEventListeners('pokemonToggle', data));
api.on('prizeToggle', (data) => triggerEventListeners('prizeToggle', data));
api.on('handToggle', (data) => triggerEventListeners('handToggle', data));
api.on('deckLoaded', (data) => triggerEventListeners('deckLoaded', data));
api.on('boardState', (data) => triggerEventListeners('boardState', data));

// Clean up event listeners when module is hot-reloaded (for development)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    api.off('connection', handleConnectionStatus);
    api.off('chatMessage', handleChatMessage);
    api.off('opponentJoined', handleOpponentJoined);
    api.off('opponentLeft', handleOpponentLeft);
    
    // Remove all registered game action listeners
    [
      'joinedRoom', 'boardReset', 'cardsMoved', 'slotsMoved', 
      'cardsBenched', 'activeBenched', 'cardPromoted', 'slotPromoted', 
      'cardsEvolved', 'cardsAttached', 'damageUpdated', 'oppDamageUpdated',
      'markerUpdated', 'slotDiscarded', 'stadiumPlayed', 'pokemonToggle',
      'prizeToggle', 'handToggle', 'deckLoaded', 'boardState'
    ].forEach(event => {
      api.off(event, data => triggerEventListeners(event, data));
    });
  });
}