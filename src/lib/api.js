// File: meta-tabletop/src/lib/api.js
// Project: CLIENT
// Purpose: API service for connecting to the Worker backend

/**
 * API service for Tabletop Gaming platform
 * Handles communication with the Cloudflare Worker backend
 */

// Get API URL from environment variables or use default for development
const API_BASE = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_URL) || 
  'https://api.tabletop.meta-ptcg.org';

// Event dispatcher for WebSocket events
const listeners = new Map();

/**
 * Creates a new game room
 * @returns {Promise<string>} Room ID for the created room
 */
export async function createRoom() {
  try {
    const response = await fetch(`${API_BASE}/create_room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.roomId;
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

/**
 * Fetches list of available rooms
 * @returns {Promise<Array>} List of rooms
 */
export async function listRooms() {
  try {
    const response = await fetch(`${API_BASE}/rooms`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching rooms:', error);
    throw error;
  }
}

/**
 * Connect to a room via WebSocket
 * @param {string} roomId - ID of the room to connect to
 * @returns {WebSocket} WebSocket connection
 */
export function connectToRoom(roomId) {
  // Create WebSocket URL (ws:// or wss:// based on API URL)
  const wsBase = API_BASE.replace(/^http/, 'ws');
  const socket = new WebSocket(`${wsBase}/room/${roomId}`);
  
  // Socket event handlers
  socket.addEventListener('open', () => {
    console.log(`Connected to room: ${roomId}`);
    dispatch('connection', { status: 'connected', roomId });
    
    // Send join room message
    sendMessage(socket, {
      type: 'joinRoom',
      roomId
    });
  });
  
  socket.addEventListener('close', (event) => {
    console.log(`Disconnected from room: ${roomId}`, event.code, event.reason);
    dispatch('connection', { status: 'disconnected', roomId, code: event.code });
  });
  
  socket.addEventListener('error', (error) => {
    console.error(`WebSocket error for room ${roomId}:`, error);
    dispatch('connection', { status: 'error', roomId, error });
  });
  
  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      // Dispatch event based on message type
      dispatch(data.type, data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  return socket;
}

/**
 * Send a message through the WebSocket
 * @param {WebSocket} socket - WebSocket connection
 * @param {object} message - Message to send
 */
export function sendMessage(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn('WebSocket not open, message not sent');
  }
}

/**
 * Send chat message
 * @param {WebSocket} socket - WebSocket connection
 * @param {string} message - Chat message
 * @param {string} type - Message type (chat, important, etc.)
 */
export function sendChatMessage(socket, message, type = 'chat') {
  sendMessage(socket, {
    type: 'chatMessage',
    message,
    messageType: type,
    time: new Date().toISOString(),
    self: true
  });
}

/**
 * Update board state
 * @param {WebSocket} socket - WebSocket connection
 * @param {object} boardState - New board state
 */
export function updateBoardState(socket, boardState) {
  sendMessage(socket, {
    type: 'boardState',
    ...boardState
  });
}

/**
 * Leave room
 * @param {WebSocket} socket - WebSocket connection
 */
export function leaveRoom(socket) {
  sendMessage(socket, {
    type: 'leaveRoom'
  });
  socket.close();
}

/**
 * Register event listener
 * @param {string} event - Event name
 * @param {Function} callback - Event handler
 */
export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event).push(callback);
}

/**
 * Remove event listener
 * @param {string} event - Event name
 * @param {Function} callback - Event handler to remove
 */
export function off(event, callback) {
  if (!listeners.has(event)) return;
  
  const eventListeners = listeners.get(event);
  const index = eventListeners.indexOf(callback);
  
  if (index !== -1) {
    eventListeners.splice(index, 1);
  }
}

/**
 * Dispatch event to listeners
 * @param {string} event - Event name
 * @param {*} data - Event data
 */
function dispatch(event, data) {
  if (!listeners.has(event)) return;
  
  for (const callback of listeners.get(event)) {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error in ${event} event handler:`, error);
    }
  }
}