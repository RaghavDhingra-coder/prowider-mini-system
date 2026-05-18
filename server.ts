import { createServer } from "http";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { Server } from "socket.io";
import { setSocketServer } from "./lib/socket-server";

const appDir = dirname(fileURLToPath(import.meta.url));

loadEnvConfig(appDir);

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

if (!dev) {
  const buildIdPath = join(appDir, ".next", "BUILD_ID");

  if (!existsSync(buildIdPath)) {
    throw new Error(
      "Missing Next.js production build. Run `npm run build` before `npm start`.",
    );
  }
}

const app = next({ dev, dir: appDir, hostname: host, port });
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
