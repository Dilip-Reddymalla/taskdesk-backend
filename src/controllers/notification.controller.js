const notificationModel = require("../models/notification.model");

async function getNotification(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const showRead = req.query.showRead === "true";

    // By default fetch unread only. Pass ?showRead=true to get all notifications.
    const filter = showRead ? { user: userId } : { user: userId, isRead: false };

    const [notifications, total] = await Promise.all([
      notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      notificationModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Notification fetched",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
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

async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;
    const result = await notificationModel.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );
    return res.status(200).json({
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log("[notification controller]:", error);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = { getNotification, markAsRead, markAllAsRead };
