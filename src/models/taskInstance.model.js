const mongoose = require("mongoose");

const taskInstanceSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: Date,

    images: [String],
  },
  { timestamps: true }
);

taskInstanceSchema.index({ task: 1, assignedTo: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("TaskInstance", taskInstanceSchema);