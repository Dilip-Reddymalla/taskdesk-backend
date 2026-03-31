const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },

    recurrence: {
      isRecurring: {
        type: Boolean,
        default: false,
      },

      type: {
        type: String,
        enum: ["daily", "weekly", "monthly", "custom"],
      },

      interval: {
        type: Number,
        default: 1,
      },

      daysOfWeek: [
        {
          type: Number,
        },
      ],

      endDate: {
        type: Date,
      },
    },
  },
  { timestamps: true },
);

const taskModel = mongoose.model("Task", taskSchema);
module.exports = taskModel;
