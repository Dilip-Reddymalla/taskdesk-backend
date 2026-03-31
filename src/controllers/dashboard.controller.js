const mongoose = require("mongoose");
const TaskInstance = require("../models/taskInstance.model");
const User = require("../models/user.model");
const Plan = require("../models/plan.model");

async function getDashboardStats(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const user = await User.findById(userId).select("xp streakCount");

    const completedTodayCount = await TaskInstance.countDocuments({
      assignedTo: userId,
      isCompleted: true,
      completedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyStats = await TaskInstance.aggregate([
      {
        $match: {
          assignedTo: userId,
          isCompleted: true,
          completedAt: { $gte: startOfWeek, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const weeklyCompletion = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const match = weeklyStats.find(s => s._id === dateStr);
      weeklyCompletion.push({ date: dateStr, count: match ? match.count : 0 });
    }

    const pendingTasks = await TaskInstance.find({
      assignedTo: userId,
      isCompleted: false
    }).populate("task", "priority title");

    const priorityStats = { high: 0, medium: 0, low: 0 };
    pendingTasks.forEach(instance => {
      if (instance.task && instance.task.priority) {
        priorityStats[instance.task.priority] += 1;
      }
    });

    res.status(200).json({
      message: "Dashboard stats fetched",
      stats: {
        xp: user?.xp || 0,
        streak: user?.streakCount || 0,
        tasksCompletedToday: completedTodayCount,
        weeklyCompletion,
        activeTasksByPriority: priorityStats
      }
    });

  } catch (error) {
    console.log("[getDashboardStats Error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getDashboardStats
};
