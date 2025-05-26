/**
 * Cloudflare Worker implementing Socket.IO v4 protocol
 * Compatible with socket.io-client v4.7.2
 */

// In-memory session storage (use Durable Objects for production persistence)
const sessions = new Map();
const rooms = new Map();

// Generate unique session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Generate unique room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

// Engine.IO packet types
const ENGINE_IO_PACKETS = {
  OPEN: '0',
  CLOSE: '1', 
  PING: '2',
  PONG: '3',
  MESSAGE: '4',
  UPGRADE: '5',
  NOOP: '6'
};

// Socket.IO packet types
const SOCKET_IO_PACKETS = {
  CONNECT: '0',
  DISCONNECT: '1',
  EVENT: '2',
  ACK: '3',
  CONNECT_ERROR: '4',
  BINARY_EVENT: '5',
  BINARY_ACK: '6'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    // Only handle Socket.IO requests
    if (!url.pathname.startsWith('/socket.io/')) {
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders 
      });
    }
    
    console.log(`Socket.IO request: ${request.method} ${url.pathname}${url.search}`);
    
    const searchParams = url.searchParams;
    const transport = searchParams.get('transport');
    const sid = searchParams.get('sid');
    const eio = searchParams.get('EIO');
    
    // Validate Engine.IO version
    if (eio !== '4') {
      return new Response('Unsupported Engine.IO version', { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    if (request.method === 'GET') {
      if (transport === 'polling') {
        return handlePollingGet(searchParams);
      } else if (transport === 'websocket') {
        // WebSocket upgrade not supported in this implementation
        return new Response('WebSocket not supported', { 
          status: 400,
          headers: corsHeaders 
        });
      }
    } else if (request.method === 'POST') {
      if (transport === 'polling') {
        return handlePollingPost(request, searchParams);
      }
    }
    
    return new Response('Bad Request', { 
      status: 400,
      headers: corsHeaders 
    });
  }
};

async function handlePollingGet(searchParams) {
  const sid = searchParams.get('sid');
  
  if (!sid) {
    // Initial handshake - create new session
    const sessionId = generateSessionId();
    const handshakeData = {
      sid: sessionId,
      upgrades: [],
      pingInterval: 25000,
      pingTimeout: 20000,
      maxPayload: 1000000
    };
    
    sessions.set(sessionId, {
      id: sessionId,
      connected: false,
      messageQueue: [],
      lastActivity: Date.now()
    });
    
    console.log(`Handshake created for session ${sessionId}`);
    
    // Proper Engine.IO v4 handshake response format
    const response = ENGINE_IO_PACKETS.OPEN + JSON.stringify(handshakeData);
    return new Response(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=UTF-8'
      }
    });
  }
  
  // Existing session - return queued messages or wait
  const session = sessions.get(sid);
  if (!session) {
    return new Response('Session not found', { 
      status: 400,
      headers: corsHeaders 
    });
  }
  
  console.log(`Polling GET for session ${sid}, connected: ${session.connected}, queue length: ${session.messageQueue.length}`);
  
  session.lastActivity = Date.now();
  
  // If not connected yet, send CONNECT packet
  if (!session.connected) {
    session.connected = true;
    const connectPacket = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.CONNECT;
    console.log(`Sending CONNECT packet to session ${sid}: ${connectPacket}`);
    return new Response(connectPacket, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=UTF-8'
      }
    });
  }
  
  // Return queued messages
  if (session.messageQueue.length > 0) {
    const message = session.messageQueue.shift();
    console.log(`Sending queued message to session ${sid}: ${message}`);
    return new Response(message, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=UTF-8'
      }
    });
  }
  
  // No messages - return empty response for long polling
  return new Response('', {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=UTF-8'
    }
  });
}

async function handlePollingPost(request, searchParams) {
  const sid = searchParams.get('sid');
  const session = sessions.get(sid);
  
  if (!session) {
    console.log(`Session not found for POST: ${sid}`);
    return new Response('Session not found', { 
      status: 400,
      headers: corsHeaders 
    });
  }
  
  try {
    const body = await request.text();
    console.log(`Received POST data from session ${sid}: ${body}`);
    
    session.lastActivity = Date.now();
    
    // Parse Engine.IO packets - handle both single packets and payload format
    const packets = parseEngineIOPackets(body);
    
    for (const packet of packets) {
      console.log(`Engine.IO packet from ${sid}: type=${packet.type}, payload=${packet.payload}`);
      
      if (packet.type === ENGINE_IO_PACKETS.MESSAGE) {
        // Handle Socket.IO message
        const socketIOPacket = parseSocketIOPacket(packet.payload);
        console.log(`Socket.IO packet from ${sid}: type=${socketIOPacket.type}, data=${JSON.stringify(socketIOPacket.data)}`);
        
        if (socketIOPacket.type === SOCKET_IO_PACKETS.EVENT) {
          handleSocketIOEvent(sid, session, socketIOPacket.data);
        }
      } else if (packet.type === ENGINE_IO_PACKETS.PING) {
        // Respond with PONG
        session.messageQueue.push(ENGINE_IO_PACKETS.PONG);
        console.log(`Queued PONG response for session ${sid}`);
      }
    }
    
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=UTF-8'
      }
    });
  } catch (error) {
    console.error(`Error handling POST for session ${sid}:`, error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders 
    });
  }
}

function parseEngineIOPackets(data) {
  const packets = [];
  
  // Handle single packet (no length prefix)
  if (!data.includes(':')) {
    const type = data[0];
    const payload = data.substring(1);
    packets.push({ type, payload });
    return packets;
  }
  
  // Handle payload format with length prefixes
  let i = 0;
  while (i < data.length) {
    // Find packet length
    let lengthEnd = data.indexOf(':', i);
    if (lengthEnd === -1) {
      // No more length prefixes, treat rest as single packet
      if (i < data.length) {
        const type = data[i];
        const payload = data.substring(i + 1);
        packets.push({ type, payload });
      }
      break;
    }
    
    const length = parseInt(data.substring(i, lengthEnd));
    if (isNaN(length)) break;
    
    const packetStart = lengthEnd + 1;
    const packetEnd = packetStart + length;
    
    if (packetEnd > data.length) break;
    
    const packetData = data.substring(packetStart, packetEnd);
    const type = packetData[0];
    const payload = packetData.substring(1);
    
    packets.push({ type, payload });
    i = packetEnd;
  }
  
  return packets;
}

function parseSocketIOPacket(data) {
  if (!data) return { type: null, data: null };
  
  const type = data[0];
  const payload = data.substring(1);
  
  try {
    const parsed = JSON.parse(payload);
    return { type, data: parsed };
  } catch (e) {
    return { type, data: payload };
  }
}

function handleSocketIOEvent(sessionId, session, eventData) {
  if (!Array.isArray(eventData) || eventData.length === 0) return;
  
  const eventName = eventData[0];
  const eventPayload = eventData[1] || {};
  
  console.log(`Socket.IO event from ${sessionId}: ${eventName} ${JSON.stringify(eventPayload)}`);
  
  switch (eventName) {
    case 'createRoom':
      const roomId = generateRoomId();
      rooms.set(roomId, {
        id: roomId,
        host: sessionId,
        players: [sessionId],
        createdAt: Date.now()
      });
      
      session.roomId = roomId;
      console.log(`Room ${roomId} created for session ${sessionId}`);
      
      // Queue response
      const createResponse = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + 
        JSON.stringify(['createdRoom', { roomId, isHost: true }]);
      session.messageQueue.push(createResponse);
      break;
      
    case 'joinRoom':
      const targetRoomId = eventPayload.roomId;
      const room = rooms.get(targetRoomId);
      
      if (room && !room.players.includes(sessionId)) {
        room.players.push(sessionId);
        session.roomId = targetRoomId;
        
        console.log(`Session ${sessionId} joined room ${targetRoomId}`);
        
        // Queue response
        const joinResponse = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + 
          JSON.stringify(['joinedRoom', { roomId: targetRoomId, isHost: false }]);
        session.messageQueue.push(joinResponse);
        
        // Notify other players
        broadcastToRoom(targetRoomId, 'playerJoined', { sessionId }, sessionId);
      } else {
        console.log(`Failed to join room ${targetRoomId} for session ${sessionId}`);
      }
      break;
      
    case 'leaveRoom':
      if (session.roomId) {
        const room = rooms.get(session.roomId);
        if (room) {
          room.players = room.players.filter(p => p !== sessionId);
          if (room.players.length === 0) {
            rooms.delete(session.roomId);
          } else {
            broadcastToRoom(session.roomId, 'playerLeft', { sessionId }, sessionId);
          }
        }
        session.roomId = null;
        
        // Queue response
        const leaveResponse = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + 
          JSON.stringify(['leftRoom', {}]);
        session.messageQueue.push(leaveResponse);
      }
      break;
      
    case 'chatMessage':
      if (session.roomId) {
        broadcastToRoom(session.roomId, 'chatMessage', {
          message: eventPayload.message,
          from: sessionId,
          time: new Date().toISOString(),
          type: eventPayload.type || 'chat'
        });
      }
      break;
      
    case 'logMessage':
      if (session.roomId) {
        broadcastToRoom(session.roomId, 'logMessage', {
          log: eventPayload.log,
          from: sessionId,
          time: new Date().toISOString()
        });
      }
      break;
      
    default:
      console.log(`Unknown event: ${eventName}`);
  }
}

function broadcastToRoom(roomId, eventName, data, excludeSessionId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const message = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + 
    JSON.stringify([eventName, data]);
  
  console.log(`Broadcasting to room ${roomId}: ${eventName}`);
  
  for (const playerId of room.players) {
    if (playerId !== excludeSessionId) {
      const playerSession = sessions.get(playerId);
      if (playerSession) {
        playerSession.messageQueue.push(message);
        console.log(`Queued message for player ${playerId}`);
      }
    }
  }
} 