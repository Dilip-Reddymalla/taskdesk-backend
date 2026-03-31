const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const notificationController = require("../controllers/notification.controller")

const router = express.Router();

// GET /api/notification/get?page=1           → unread notifications (paginated)
// GET /api/notification/get?showRead=true    → all notifications including read
router.get("/get", protect, notificationController.getNotification);
router.patch("/read/:notificationId", protect, notificationController.markAsRead);
router.patch("/read-all", protect, notificationController.markAllAsRead);