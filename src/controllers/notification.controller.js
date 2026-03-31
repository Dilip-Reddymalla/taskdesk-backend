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
async function markAsRead(req, res) {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.user.id;
    if (!notificationId) {
      return res.status(400).json({ message: "notification id is required" });
    }
    const notification = await notificationModel.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        message: "notification not found or not yours",
      });
    }
    return res.status(200).json({
      message: "notification marked as read",
    });
  } catch (error) {
    console.log("[notification controller]:", error);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = { getNotification, markAsRead };
