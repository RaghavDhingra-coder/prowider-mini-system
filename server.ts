import { createServer } from "http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { Server } from "socket.io";
import { setSocketServer } from "./lib/socket-server";

loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((request, response) => {
    handle(request, response);
  });

  // Socket.IO is created once on the Node server and reused by API routes.
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", () => {
    console.log("Socket client connected");
  });

  setSocketServer(io);

  httpServer.listen(port, host, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
