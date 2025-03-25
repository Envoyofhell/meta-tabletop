// src/lib/api.js
const API_BASE = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

// Regular API calls
export async function createRoom() {
    try {
        const response = await fetch(`${API_BASE}/create_room`, {
            method: 'POST',
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to create room:', error);
        throw error;
    }
}

// WebSocket connection
export function connectToRoom(roomId) {
    // Convert HTTP/HTTPS to WS/WSS
    const wsBase = API_BASE.replace('http', 'ws');
    const socket = new WebSocket(`${wsBase}/room?id=${roomId}`);
    
    socket.onopen = () => console.log('WebSocket connection established');
    socket.onerror = (error) => console.error('WebSocket error:', error);
    
    return socket;
}