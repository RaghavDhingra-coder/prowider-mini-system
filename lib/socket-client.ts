import { io, Socket } from "socket.io-client";

const SOCKET_EVENT_LEAD_ASSIGNED = "lead:assigned";

const globalForSocket = globalThis as typeof globalThis & {
  socket: Socket | null;
};

export function getSocketClient() {
  if (!globalForSocket.socket) {
    // Reuse one browser socket connection to avoid duplicate clients on reload.
    globalForSocket.socket = io({
      autoConnect: true,
    });
  }

  return globalForSocket.socket;
}

export { SOCKET_EVENT_LEAD_ASSIGNED };
