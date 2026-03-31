const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
      }
    });

    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id} (User: ${socket.user.id})`);

      socket.join(`user_${socket.user.id}`);

      socket.on("join_plan", (planId) => {
        socket.join(`plan_${planId}`);
      });

      socket.on("leave_plan", (planId) => {
        socket.leave(`plan_${planId}`);
      });

      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      console.warn("Socket.io not initialized! This might happen during testing if server isn't started normally.");
      // Return a dummy object so tests don't break if io isn't initialized yet
      return { to: () => ({ emit: () => {} }), emit: () => {} };
    }
    return io;
  }
};
