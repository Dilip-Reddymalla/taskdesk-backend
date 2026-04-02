const mongoose = require("mongoose");
const TaskInstance = require("../models/taskInstance.model");
const User = require("../models/user.model");
const Plan = require("../models/plan.model");

async function getDashboardStats(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get current time in UTC
    const nowOutput = new Date();
    // Shift the Date object's UTC value by +5.5 hours. 
    // This allows us to use standard UTC methods (getUTCDay, setUTCDate) to perform flawless IST calendar logic.
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istVirtualTime = new Date(nowOutput.getTime() + IST_OFFSET);

    // Calculate Start/End of Day strictly in IST terms
    const startOfDayIST = new Date(istVirtualTime);
    startOfDayIST.setUTCHours(0, 0, 0, 0);
    const startOfDayUTC = new Date(startOfDayIST.getTime() - IST_OFFSET);

    const endOfDayIST = new Date(startOfDayIST);
    endOfDayIST.setUTCHours(23, 59, 59, 999);
    const endOfDayUTC = new Date(endOfDayIST.getTime() - IST_OFFSET);

    const user = await User.findById(userId).select("xp streakCount");

    const completedTodayCount = await TaskInstance.countDocuments({
      assignedTo: userId,
      isCompleted: true,
      completedAt: { $gte: startOfDayUTC, $lte: endOfDayUTC }
    });

    // Calculate the start of the current calendar week (Sunday) strictly in IST terms
    const currentDayOfWeek = istVirtualTime.getUTCDay(); // 0 is Sunday
    const startOfWeekIST = new Date(startOfDayIST);
    startOfWeekIST.setUTCDate(startOfWeekIST.getUTCDate() - currentDayOfWeek);
    const startOfWeekUTC = new Date(startOfWeekIST.getTime() - IST_OFFSET);

    const weeklyStats = await TaskInstance.aggregate([
      {
        $match: {
          assignedTo: userId,
          isCompleted: true,
          completedAt: { $gte: startOfWeekUTC, $lte: endOfDayUTC }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: "+05:30" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const weeklyCompletion = [];
    // Generate an array of 7 days strictly from Sunday to Saturday for the current week (IST)
    for (let i = 0; i < 7; i++) {
      const dIST = new Date(startOfWeekIST);
      dIST.setUTCDate(startOfWeekIST.getUTCDate() + i);
      const yr = dIST.getUTCFullYear();
      const mo = String(dIST.getUTCMonth() + 1).padStart(2, '0');
      const da = String(dIST.getUTCDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${da}`;
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
