var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-9b9xWZ/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
var sessions = /* @__PURE__ */ new Map();
var rooms = /* @__PURE__ */ new Map();
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
__name(generateSessionId, "generateSessionId");
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}
__name(generateRoomId, "generateRoomId");
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400"
};
var ENGINE_IO_PACKETS = {
  OPEN: "0",
  CLOSE: "1",
  PING: "2",
  PONG: "3",
  MESSAGE: "4",
  UPGRADE: "5",
  NOOP: "6"
};
var SOCKET_IO_PACKETS = {
  CONNECT: "0",
  DISCONNECT: "1",
  EVENT: "2",
  ACK: "3",
  CONNECT_ERROR: "4",
  BINARY_EVENT: "5",
  BINARY_ACK: "6"
};
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    if (!url.pathname.startsWith("/socket.io/")) {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders
      });
    }
    console.log(`Socket.IO request: ${request.method} ${url.pathname}${url.search}`);
    const searchParams = url.searchParams;
    const transport = searchParams.get("transport");
    const sid = searchParams.get("sid");
    if (request.method === "GET") {
      if (transport === "polling") {
        return handlePollingGet(searchParams);
      } else if (transport === "websocket") {
        return new Response("WebSocket not supported", {
          status: 400,
          headers: corsHeaders
        });
      }
    } else if (request.method === "POST") {
      if (transport === "polling") {
        return handlePollingPost(request, searchParams);
      }
    }
    return new Response("Bad Request", {
      status: 400,
      headers: corsHeaders
    });
  }
};
async function handlePollingGet(searchParams) {
  const sid = searchParams.get("sid");
  if (!sid) {
    const sessionId = generateSessionId();
    const handshakeData = {
      sid: sessionId,
      upgrades: [],
      pingInterval: 25e3,
      pingTimeout: 2e4,
      maxPayload: 1e6
    };
    sessions.set(sessionId, {
      id: sessionId,
      connected: false,
      messageQueue: [],
      lastActivity: Date.now()
    });
    console.log(`Handshake created for session ${sessionId}`);
    const response = ENGINE_IO_PACKETS.OPEN + JSON.stringify(handshakeData);
    return new Response(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }
  const session = sessions.get(sid);
  if (!session) {
    return new Response("Session not found", {
      status: 400,
      headers: corsHeaders
    });
  }
  console.log(`Polling GET for session ${sid}, connected: ${session.connected}, queue length: ${session.messageQueue.length}`);
  session.lastActivity = Date.now();
  if (!session.connected) {
    session.connected = true;
    const connectPacket = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.CONNECT;
    console.log(`Sending CONNECT packet to session ${sid}: ${connectPacket}`);
    return new Response(connectPacket, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }
  if (session.messageQueue.length > 0) {
    const message = session.messageQueue.shift();
    console.log(`Sending queued message to session ${sid}: ${message}`);
    return new Response(message, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }
  return new Response("", {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=UTF-8"
    }
  });
}
__name(handlePollingGet, "handlePollingGet");
async function handlePollingPost(request, searchParams) {
  const sid = searchParams.get("sid");
  const session = sessions.get(sid);
  if (!session) {
    return new Response("Session not found", {
      status: 400,
      headers: corsHeaders
    });
  }
  const body = await request.text();
  console.log(`Received POST data from session ${sid}: ${body}`);
  session.lastActivity = Date.now();
  const packets = parseEngineIOPackets(body);
  for (const packet of packets) {
    console.log(`Engine.IO packet from ${sid}: type=${packet.type}, payload=${packet.payload}`);
    if (packet.type === ENGINE_IO_PACKETS.MESSAGE) {
      const socketIOPacket = parseSocketIOPacket(packet.payload);
      console.log(`Socket.IO packet from ${sid}: type=${socketIOPacket.type}, data=${JSON.stringify(socketIOPacket.data)}`);
      if (socketIOPacket.type === SOCKET_IO_PACKETS.EVENT) {
        handleSocketIOEvent(sid, session, socketIOPacket.data);
      }
    } else if (packet.type === ENGINE_IO_PACKETS.PING) {
      session.messageQueue.push(ENGINE_IO_PACKETS.PONG);
    }
  }
  return new Response("ok", {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=UTF-8"
    }
  });
}
__name(handlePollingPost, "handlePollingPost");
function parseEngineIOPackets(data) {
  const packets = [];
  let i = 0;
  while (i < data.length) {
    let lengthEnd = data.indexOf(":", i);
    if (lengthEnd === -1) break;
    const length = parseInt(data.substring(i, lengthEnd));
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
__name(parseEngineIOPackets, "parseEngineIOPackets");
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
__name(parseSocketIOPacket, "parseSocketIOPacket");
function handleSocketIOEvent(sessionId, session, eventData) {
  if (!Array.isArray(eventData) || eventData.length === 0) return;
  const eventName = eventData[0];
  const eventPayload = eventData[1] || {};
  console.log(`Socket.IO event from ${sessionId}: ${eventName} ${JSON.stringify(eventPayload)}`);
  switch (eventName) {
    case "createRoom":
      const roomId = generateRoomId();
      rooms.set(roomId, {
        id: roomId,
        host: sessionId,
        players: [sessionId],
        createdAt: Date.now()
      });
      session.roomId = roomId;
      console.log(`Room ${roomId} created for session ${sessionId}`);
      const createResponse = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + JSON.stringify(["createdRoom", { roomId, isHost: true }]);
      session.messageQueue.push(createResponse);
      break;
    case "joinRoom":
      const targetRoomId = eventPayload.roomId;
      const room = rooms.get(targetRoomId);
      if (room && !room.players.includes(sessionId)) {
        room.players.push(sessionId);
        session.roomId = targetRoomId;
        console.log(`Session ${sessionId} joined room ${targetRoomId}`);
        const joinResponse = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + JSON.stringify(["joinedRoom", { roomId: targetRoomId, isHost: false }]);
        session.messageQueue.push(joinResponse);
        broadcastToRoom(targetRoomId, "playerJoined", { sessionId }, sessionId);
      }
      break;
    case "chatMessage":
      if (session.roomId) {
        broadcastToRoom(session.roomId, "chatMessage", {
          message: eventPayload.message,
          from: sessionId,
          time: (/* @__PURE__ */ new Date()).toISOString(),
          type: eventPayload.type || "chat"
        });
      }
      break;
    case "logMessage":
      if (session.roomId) {
        broadcastToRoom(session.roomId, "logMessage", {
          log: eventPayload.log,
          from: sessionId,
          time: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      break;
    default:
      console.log(`Unknown event: ${eventName}`);
  }
}
__name(handleSocketIOEvent, "handleSocketIOEvent");
function broadcastToRoom(roomId, eventName, data, excludeSessionId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const message = ENGINE_IO_PACKETS.MESSAGE + SOCKET_IO_PACKETS.EVENT + JSON.stringify([eventName, data]);
  for (const playerId of room.players) {
    if (playerId !== excludeSessionId) {
      const playerSession = sessions.get(playerId);
      if (playerSession) {
        playerSession.messageQueue.push(message);
      }
    }
  }
}
__name(broadcastToRoom, "broadcastToRoom");

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-9b9xWZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-9b9xWZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
