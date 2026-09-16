const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory data store for sessions and messages
const sessions = new Map(); // sessionId -> { status: 'active' | 'paused' | 'ended', createdAt: Date }
const messages = new Map(); // sessionId -> [ { id, content, createdAt, status: 'visible' | 'hidden' | 'deleted' | 'answered' } ]

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    // Presenter creating/joining a session
    socket.on("join-session", (sessionId) => {
      socket.join(sessionId);
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { status: "active", createdAt: new Date() });
        messages.set(sessionId, []);
      }
      
      // Send current session state and messages
      socket.emit("session-state", sessions.get(sessionId));
      socket.emit("all-messages", messages.get(sessionId).filter(m => m.status !== "deleted"));
    });

    // Audience joining a session to send messages
    socket.on("join-audience", (sessionId) => {
      if (sessions.has(sessionId)) {
        socket.join(`audience-${sessionId}`);
        socket.emit("session-state", sessions.get(sessionId));
      } else {
        socket.emit("error", "Session not found");
      }
    });

    // Audience sending a message
    socket.on("send-message", ({ sessionId, content }) => {
      const session = sessions.get(sessionId);
      if (!session) {
        socket.emit("error", "Session not found");
        return;
      }
      if (session.status !== "active") {
        socket.emit("error", `Session is ${session.status}`);
        return;
      }
      if (!content || content.trim().length === 0 || content.length > 500) {
        socket.emit("error", "Invalid message length");
        return;
      }

      const message = {
        id: Math.random().toString(36).substring(2, 9),
        content: content.trim(),
        createdAt: new Date(),
        status: "visible"
      };

      const sessionMessages = messages.get(sessionId) || [];
      sessionMessages.push(message);
      messages.set(sessionId, sessionMessages);

      // Broadcast to presenter
      io.to(sessionId).emit("new-message", message);
      // Confirm to sender
      socket.emit("message-sent", message.id);
    });

    // Presenter updating session status
    socket.on("update-session-status", ({ sessionId, status }) => {
      if (sessions.has(sessionId) && ["active", "paused", "ended"].includes(status)) {
        const session = sessions.get(sessionId);
        session.status = status;
        sessions.set(sessionId, session);
        
        io.to(sessionId).emit("session-state", session);
        io.to(`audience-${sessionId}`).emit("session-state", session);
      }
    });

    // Presenter moderating a message
    socket.on("update-message-status", ({ sessionId, messageId, status }) => {
      if (messages.has(sessionId)) {
        const sessionMessages = messages.get(sessionId);
        const msgIndex = sessionMessages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
          sessionMessages[msgIndex].status = status;
          io.to(sessionId).emit("message-updated", sessionMessages[msgIndex]);
        }
      }
    });
    
    // Clear all messages
    socket.on("clear-messages", ({ sessionId }) => {
      if (messages.has(sessionId)) {
        const sessionMessages = messages.get(sessionId);
        sessionMessages.forEach(m => m.status = "deleted");
        io.to(sessionId).emit("all-messages", []);
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
