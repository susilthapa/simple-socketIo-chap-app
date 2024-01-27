import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Server as SocketServer } from "socket.io";

const app = express();
const server = createServer(app);

const io = new SocketServer(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  console.log("======= Connected =========");
  socket.on("chat message", (message) => {
    io.emit("chat message", message);
  });
});
server.listen(3000, () => {
  console.log("**** server running at http://localhost:3000 ****");
});
