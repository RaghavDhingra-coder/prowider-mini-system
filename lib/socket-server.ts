import { Server } from "socket.io";

const SOCKET_EVENT_LEAD_ASSIGNED = "lead:assigned";

const globalForSocket = global as typeof globalThis & {
  io: Server | null;
};

if (!globalForSocket.io) {
  globalForSocket.io = null;
}

export function setSocketServer(io: Server) {
  globalForSocket.io = io;
}

export function getSocketServer() {
  return globalForSocket.io;
}

export function emitLeadAssigned() {
  const io = getSocketServer();

  if (!io) {
    return;
  }

  // When a lead is assigned, dashboards can refetch fresh provider data.
  io.emit(SOCKET_EVENT_LEAD_ASSIGNED);
}

export { SOCKET_EVENT_LEAD_ASSIGNED };
