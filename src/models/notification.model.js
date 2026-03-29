const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "task_assigned",
        "task_completed",
        "task_updated",
        "invite_received",
      ],
    },

    message: {
      type: String,
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


const notificationModel = mongoose.model("Notification", notificationSchema);

module.exports = notificationModel;