const Task = require("../models/task.model");
const TaskInstance = require("../models/taskInstance.model");
const User = require("../models/user.model");
const planContoller = require("../controllers/plan.controller");
const Plan = require("../models/plan.model");
const { getIO } = require("../socket");
const uploadFile = require("../services/imagekit.service");

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

    try {
      getIO().to(`plan_${planId}`).emit("task_created", task);
    } catch (err) {
      console.log("Socket emit failed", err.message);
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let instance = await TaskInstance.findOne({
      task: taskId,
      assignedTo: userId,
      date: { $gte: startOfDay, $lte: endOfDay },
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
        date: startOfDay,
      });
    }

    if (instance.isCompleted) {
      return res.status(200).json({
        message: "Task already completed",
        instance,
      });
    }

    instance.isCompleted = true;
    instance.completedAt = new Date();
    await instance.save();

    await User.findByIdAndUpdate(userId, { $inc: { xp: 10 } });

    const taskObj = await Task.findById(taskId);
    if (taskObj && taskObj.recurrence && taskObj.recurrence.isRecurring) {
      let nextDate = new Date(instance.date);

      switch (taskObj.recurrence.type) {
        case "daily":
          nextDate.setDate(nextDate.getDate() + (taskObj.recurrence.interval || 1));
          break;
        case "weekly":
          nextDate.setDate(nextDate.getDate() + 7 * (taskObj.recurrence.interval || 1));
          break;
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + (taskObj.recurrence.interval || 1));
          break;
        case "custom":
          nextDate.setDate(nextDate.getDate() + (taskObj.recurrence.interval || 1));
          break;
      }

      if (!taskObj.recurrence.endDate || nextDate <= new Date(taskObj.recurrence.endDate)) {
        nextDate.setHours(0, 0, 0, 0);
        const endOfNextDay = new Date(nextDate);
        endOfNextDay.setHours(23, 59, 59, 999);

        const existingNext = await TaskInstance.findOne({
          task: taskId,
          assignedTo: userId,
          date: { $gte: nextDate, $lte: endOfNextDay },
        });

        if (!existingNext) {
          await TaskInstance.create({
            task: taskId,
            plan: taskObj.plan,
            assignedTo: userId,
            date: new Date(nextDate),
          });
        }
      }
    }

    await planContoller.updatePlanStreak(instance.plan);
    await planContoller.updateUserStreak(userId);

    try {
      getIO().to(`plan_${instance.plan}`).emit("task_completed", { instanceId: instance._id, taskId: taskId });
    } catch (err) {
      console.log("Socket emit failed", err.message);
    }

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
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const [tasks, total] = await Promise.all([
      TaskInstance.find({ assignedTo: userId, isCompleted: false })
        .populate("task", "title description priority recurrence")
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit),
      TaskInstance.countDocuments({ assignedTo: userId, isCompleted: false }),
    ]);

    res.status(200).json({
      message: "Tasks fetched",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      tasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

async function getCompletedTasks(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const [tasks, total] = await Promise.all([
      TaskInstance.find({ assignedTo: userId, isCompleted: true })
        .populate("task", "title description priority recurrence")
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit),
      TaskInstance.countDocuments({ assignedTo: userId, isCompleted: true }),
    ]);

    res.status(200).json({
      message: "Tasks fetched",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      tasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
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
      isCompleted: false,
    });

    await task.deleteOne();
    res.status(200).json({ message: "task deleted" });
  } catch (error) {
    console.log("[task contriller]:", error);
    res.status(500).json({ message: "Server error" });
  }
}
async function addUploadedFile(req, res) {
  try {
    const { taskInstanceId } = req.body;
    const userId = req.user.id;
    if (!taskInstanceId) {
      return res.status(400).json({ message: "Task instance id is required" });
    }
    if (!userId) {
      return res.status(400).json({ message: "User Id is required" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "files are required" });
    }
    if (req.files.length > 10) {
      return res.status(400).json({ message: "Too many files" });
    }
    const taskIns = await TaskInstance.findById(taskInstanceId);
    if (!taskIns) {
      return res.status(404).json({ message: "no tasks found" });
    }
    if (taskIns.assignedTo.toString() !== userId.toString()) {
      return res.status(403).json({ message: "not authorized" });
    }
    const uploadPromises = req.files.map((file) => uploadFile(file));
    const imageUrls = await Promise.all(uploadPromises);
    taskIns.images.push(...imageUrls);
    await taskIns.save();

    return res.status(200).json({
      message: "files uploaded",
      files: imageUrls,
    });
  } catch (error) {
    console.log("[task controller:]", error);
    return res.status(500).json({ message: "server error" });
  }
}
async function updateTask(req, res) {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const { title, description, priority, assignedTo } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this task" });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    
    if (assignedTo && Array.isArray(assignedTo)) {
      const plan = await Plan.findById(task.plan);
      const invalidUsers = assignedTo.filter(id => !plan.members.includes(id));
      if (invalidUsers.length > 0) {
        return res.status(400).json({ message: "Assigned users must be part of the plan" });
      }
      task.assignedTo = assignedTo;
    }

    await task.save();

    try {
      getIO().to(`plan_${task.plan}`).emit("task_updated", task);
    } catch (err) {
      console.log("Socket emit failed", err.message);
    }

    res.status(200).json({
      message: "Task updated successfully",
      task
    });
  } catch (error) {
    console.log("[updateTask error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function rescheduleTaskInstance(req, res) {
  try {
    const { instanceId } = req.params;
    const userId = req.user.id;
    const { newDate } = req.body;

    if (!newDate) {
      return res.status(400).json({ message: "newDate is required" });
    }

    const instance = await TaskInstance.findById(instanceId);
    if (!instance) {
      return res.status(404).json({ message: "Task instance not found" });
    }

    const plan = await Plan.findById(instance.plan);
    if (!plan.members.includes(userId)) {
      return res.status(403).json({ message: "Not authorized to reschedule tasks in this plan" });
    }

    const parsedDate = new Date(newDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    parsedDate.setHours(0, 0, 0, 0);

    instance.date = parsedDate;
    await instance.save();

    try {
      getIO().to(`plan_${instance.plan}`).emit("task_rescheduled", instance);
    } catch (err) {
      console.log("Socket emit failed", err.message);
    }

    res.status(200).json({
      message: "Task rescheduled successfully",
      instance
    });
  } catch(error) {
    console.log("[rescheduleTaskInstance error]:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Task instance already exists for this user on this date" });
    }
    res.status(500).json({ message: "Server error" });
  }
}

async function getCalendarTasks(req, res) {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const tasks = await TaskInstance.find({
      assignedTo: userId,
      date: { $gte: start, $lte: end }
    }).populate("task plan");

    res.status(200).json({
      message: "Calendar tasks fetched",
      tasks
    });
  } catch (error) {
    console.log("[getCalendarTasks error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function searchTasks(req, res) {
  try {
    const userId = req.user.id;
    const { q, priority, completed, plan } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    let filter = { assignedTo: userId };

    if (completed !== undefined) {
      filter.isCompleted = completed === "true";
    }

    if (plan) {
      filter.plan = plan;
    }

    let taskFilter = {};
    if (q) {
      taskFilter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } }
      ];
    }
    if (priority) {
      taskFilter.priority = priority;
    }

    if (Object.keys(taskFilter).length > 0) {
      const matchedTasks = await Task.find(taskFilter).select("_id");
      const taskIds = matchedTasks.map(t => t._id);
      filter.task = { $in: taskIds };
    }

    const [instances, total] = await Promise.all([
      TaskInstance.find(filter)
        .populate("task", "title description priority recurrence")
        .populate("plan", "title")
        .skip(skip)
        .limit(limit),
      TaskInstance.countDocuments(filter),
    ]);

    res.status(200).json({
      message: "Search completed",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      tasks: instances
    });
  } catch (error) {
    console.log("[searchTasks error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createTask,
  completeTask,
  getPendingTasks,
  getCompletedTasks,
  deleteTask,
  addUploadedFile,
  updateTask,
  rescheduleTaskInstance,
  getCalendarTasks,
  searchTasks,
};
