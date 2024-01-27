import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Server as SocketServer } from "socket.io";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

// open the database file
const db = await open({
  filename: "chat.db",
  driver: sqlite3.Database,
});

// create our 'messages' table (you can ignore the 'client_offset' column for now)
await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
  );
`);

const app = express();
const server = createServer(app);

const io = new SocketServer(
  server,
  /**
   * connectionStateRecovery
   * This feature will temporarily store all the events that are sent by the server and will try to restore the state of a client when it reconnects.
   *    - restore its rooms
   *    - send any missed events
   * Great! Now, you may ask:

        But this is an awesome feature, why isn't this enabled by default?

        There are several reasons for this:

        it doesn't always work, for example if the server abruptly crashes or gets restarted, then the client state might not be saved
        it is not always possible to enable this feature when scaling up
        TIP:
        That being said, it is indeed a great feature since you don't have to synchronize the state of the client after a temporary disconnection (for example, when the user switches from WiFi to 4G).

        Visit: https://socket.io/docs/v4/tutorial/step-6
   */
  { connectionStateRecovery: {} }
);
const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", async (socket) => {
  console.log("======= Connected =========");
  socket.on("chat message", async (msg, clientOffset, callback) => {
    let result;
    try {
      result = await db.run(
        "INSERT INTO messages (content, client_offset) VALUES (?, ?)",
        msg,
        clientOffset
      );
    } catch (e) {
      if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
        // the message was already inserted, so we notify the client
        callback();
      } else {
        // nothing to do, just let the client retry
      }
      return;
    }
    io.emit("chat message", msg, result.lastID);
    // acknowledge the event
    callback();
  });

  if (!socket.recovered) {
    // if the connection state recovery was not successful
    try {
      await db.each(
        "SELECT id, content FROM messages WHERE id > ?",
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          socket.emit("chat message", row.content, row.id);
        }
      );
    } catch (e) {
      // something went wrong
    }
  }
});
server.listen(3000, () => {
  console.log("**** server running at http://localhost:3000 ****");
});
