const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const notificationController = require("../controllers/notification.Controller")

const router = express.Router();

router.get("/get", protect,notificationController.getNotification );
router.get("/read/:notificationId",protect,notificationController.markAsRead);