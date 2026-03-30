const Task = require("../models/task.model");
const TaskInstance = require("../models/taskInstance.model");
const User = require("../models/user.model");
const planContoller = require("../controllers/plan.controller");
const Plan = require("../models/plan.model");

async function createTask(req, res) {
  try {
    const { planId } = req.params;
    const userId = req.user.id;

    let {
      title,
      description,
      assignedTo,
      priority,
      recurrence,
      startDate,
      endDate,
    } = req.body;

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found",
      });
    }

    if (!plan.members.includes(userId)) {
      return res.status(403).json({
        message: "Not authorized to add tasks to this plan",
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    assignedTo = assignedTo?.length ? assignedTo : [userId];

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        message: "Start date cannot be after end date",
      });
    }

    const users = await User.find({
      _id: { $in: assignedTo },
    });

    if (users.length !== assignedTo.length) {
      return res.status(400).json({
        message: "Some assigned users are invalid",
      });
    }

    const invalidUsers = assignedTo.filter((id) => !plan.members.includes(id));

    if (invalidUsers.length > 0) {
      return res.status(400).json({
        message: "Assigned users must be part of the plan",
      });
    }

    const task = await Task.create({
      plan: planId,
      title,
      description,
      createdBy: userId,
      assignedTo,
      priority,
      recurrence,
    });

    if (startDate && endDate) {
      let current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        await TaskInstance.create({
          task: task._id,
          plan: task.plan,
          assignedTo: userId,
          date: new Date(current),
        });

        current.setDate(current.getDate() + 1);
      }
    }

    res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
}

async function completeTask(req, res) {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let instance = await TaskInstance.findOne({
      task: taskId,
      assignedTo: userId,
      date: today,
    });

    if (!instance) {
      const task = await Task.findById(taskId);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      instance = await TaskInstance.create({
        task: taskId,
        plan: task.plan,
        assignedTo: userId,
        date: today,
      });
    }

    if (!instance.isCompleted) {
      instance.isCompleted = true;
      instance.completedAt = new Date();
      await instance.save();

      const user = await User.findById(userId);
      if (user) {
        user.xp += 10;
        await user.save();
      }
    }

    await planContoller.updatePlanStreak(instance.plan);
    await planContoller.updateUserStreak(userId);

    res.status(200).json({
      message: "Task completed",
      instance,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getPendingTasks(req, res) {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({
        message: "Invalid user",
      });
    }
    const tasks = await TaskInstance.find({
      assignedTo: userId,
      isCompleted: false,
    });
    if (!tasks) {
      return res.status(401).json({ message: "No tasks find in userID" });
    }
    res.status(200).json({
      message: "Tasks fetched",
      length: tasks.length,
      tasks,
    });
  } catch (error) {
    res.status(500).json({
      message: error,
    });
  }
}

async function getCompletedTasks(req, res) {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({
        message: "Invalid user",
      });
    }
    const tasks = await TaskInstance.find({
      assignedTo: userId,
      isCompleted: true,
    });
    if (!tasks) {
      return res.status(401).json({ message: "No tasks find in userID" });
    }
    res.status(200).json({
      message: "Tasks fetched",
      length: tasks.length,
      tasks,
    });
  } catch (error) {
    res.status(500).json({
      message: error,
    });
  }
}
async function deleteTask(req, res) {
  try {
    const taskId = req.params.taskId;
    const userId = req.user.id;
    if (!taskId) {
      return res.status(401).json({ message: "taskId is required" });
    }
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (task.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "user does not have access" });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to start of day

    await TaskInstance.deleteMany({
      task: taskId,
      date: { $gte: today },
      status: { $ne: "completed" },
    });

    await task.deleteOne();
    res.status(200).json({ message: "task deleted" });
  } catch (error) {
    console.log("[task contriller]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createTask,
  completeTask,
  getPendingTasks,
  getCompletedTasks,
  deleteTask,
};
