const notificationModel = require("../models/notification.model");

async function getNotification(req, res) {
  try {
    const userId = req.user.id;
    const notifications = await notificationModel
      .find({ user: userId, isRead: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .skip(0);
    if (notifications.length === 0) {
      return res
        .status(404)
        .json({ message: " Notifications not found in user id" });
    }
    return res.status(200).json({
      message: "Notification fetched",
      notifications,
    });
  } catch (error) {
    console.log("[notification controller]:", error);
    return res.status(500).json({ message: "server Error" });
  }
}

module.exports = { getNotification };
