const express = require("express");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const planRoutes = require("./routes/plan.routes");
const taskRoutes = require("./routes/task.routes");
const inviteRoutes = require("./routes/invite.routes");
const userRoutes = require("./routes/user.routes");
const notificationRoutes = require("./routes/notification.routes");

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(require("cookie-parser")());

app.use("/api/auth", authRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/invite", inviteRoutes);
app.use("/api/user", userRoutes);
app.use("/api/notification",notificationRoutes)

module.exports = app;
