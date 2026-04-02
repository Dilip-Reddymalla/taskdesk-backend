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
      const isRec = recurrence && recurrence.isRecurring;
      const rType = isRec ? recurrence.type : "daily";
      const rInterval = isRec ? (recurrence.interval || 1) : 1;

      while (current <= end) {
        for (const memberId of assignedTo) {
          await TaskInstance.create({
            task: task._id,
            plan: task.plan,
            assignedTo: memberId,
            date: new Date(current),
          });
        }

        if (rType === "daily") {
          current.setDate(current.getDate() + rInterval);
        } else if (rType === "weekly") {
          current.setDate(current.getDate() + 7 * rInterval);
        } else if (rType === "monthly") {
          current.setMonth(current.getMonth() + rInterval);
        } else {
          current.setDate(current.getDate() + rInterval);
        }
      }
    } else {
      // No date range — create a single instance for today for each assigned member
      for (const memberId of assignedTo) {
        await TaskInstance.create({
          task: task._id,
          plan: task.plan,
          assignedTo: memberId,
          date: new Date(),
        });
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

    const taskObj = await Task.findById(taskId);
    if (!taskObj) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Always validate the user is actually assigned to this task
    const isAssigned = taskObj.assignedTo && taskObj.assignedTo.some(
      (id) => id.toString() === userId.toString()
    );
    if (!isAssigned) {
      return res.status(403).json({ message: "You are not assigned to this task" });
    }

    let instance = await TaskInstance.findOne({
      task: taskId,
      assignedTo: userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!instance) {
      instance = await TaskInstance.create({
        task: taskId,
        plan: taskObj.plan,
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
    // Plan earns collective XP whenever any member completes a task
    await Plan.findByIdAndUpdate(instance.plan, { $inc: { xp: 5 } });

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
        .populate("plan", "title")
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit),
      TaskInstance.countDocuments({ assignedTo: userId, isCompleted: false }),
    ]);

    const validTasks = [];
    const orphans = [];
    tasks.forEach(t => {
      if (!t.task) orphans.push(t._id);
      else validTasks.push(t);
    });

    if (orphans.length > 0) {
      await TaskInstance.deleteMany({ _id: { $in: orphans } });
    }

    res.status(200).json({
      message: "Tasks fetched",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total - orphans.length,
      tasks: validTasks,
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
        .populate("plan", "title")
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit),
      TaskInstance.countDocuments({ assignedTo: userId, isCompleted: true }),
    ]);

    const validTasks = [];
    const orphans = [];
    tasks.forEach(t => {
      if (!t.task) orphans.push(t._id);
      else validTasks.push(t);
    });

    if (orphans.length > 0) {
      await TaskInstance.deleteMany({ _id: { $in: orphans } });
    }

    res.status(200).json({
      message: "Tasks fetched",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total - orphans.length,
      tasks: validTasks,
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
    await TaskInstance.deleteMany({
      task: taskId,
    });

    await task.deleteOne();
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.log("[task controller:]", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function deleteTaskInstance(req, res) {
  try {
    const instanceId = req.params.instanceId;
    const userId = req.user.id;

    if (!instanceId) {
      return res.status(401).json({ message: "ID is required" });
    }

    const instance = await TaskInstance.findById(instanceId);
    if (!instance) {
      return res.status(404).json({ message: "Task instance not found" });
    }

    if (instance.assignedTo.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete task" });
    }

    const parentTaskId = instance.task;
    await instance.deleteOne();

    const remainingCounts = await TaskInstance.countDocuments({ task: parentTaskId });
    if (remainingCounts === 0) {
      await Task.findByIdAndDelete(parentTaskId);
    }

    res.status(200).json({ message: "Task instance deleted successfully" });
  } catch (error) {
    console.log("[task controller:]", error);
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

async function getAllTasks(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      TaskInstance.find({ assignedTo: userId })
        .populate("task", "title description priority recurrence")
        .populate("plan", "title")
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit),
      TaskInstance.countDocuments({ assignedTo: userId }),
    ]);

    const validTasks = [];
    const orphans = [];
    tasks.forEach(t => {
      if (!t.task) orphans.push(t._id);
      else validTasks.push(t);
    });

    if (orphans.length > 0) {
      await TaskInstance.deleteMany({ _id: { $in: orphans } });
    }

    res.status(200).json({
      message: "All tasks fetched",
      page,
      totalPages: Math.ceil(total / limit),
      totalCount: total - orphans.length,
      tasks: validTasks,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}

async function editTaskInstance(req, res) {
  try {
    const instanceId = req.params.instanceId;
    const { updateType, title, description, priority, date } = req.body;
    const userId = req.user.id;

    const instance = await TaskInstance.findById(instanceId).populate("task");
    if (!instance) return res.status(404).json({ message: "Instance not found" });

    if (instance.assignedTo.toString() !== userId.toString() && instance.task?.createdBy?.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (updateType === 'single') {
      if (title !== undefined) instance.title = title;
      if (description !== undefined) instance.description = description;
      if (priority !== undefined) instance.priority = priority;
      if (date !== undefined) instance.date = new Date(date);
      await instance.save();

      try { getIO().to(`plan_${instance.plan}`).emit("task_updated", instance); } catch(e){}
      return res.status(200).json({ message: "Task instance updated", instance });

    } else if (updateType === 'future') {
      const parentTask = await Task.findById(instance.task._id);
      if (!parentTask) return res.status(404).json({ message: "Parent task missing" });

      if (title !== undefined) parentTask.title = title;
      if (description !== undefined) parentTask.description = description;
      if (priority !== undefined) parentTask.priority = priority;
      await parentTask.save();

      const futureQuery = {
        task: parentTask._id,
        date: { $gte: instance.date }
      };

      await TaskInstance.updateMany(futureQuery, {
        $unset: { title: "", description: "", priority: "" }
      });

      if (date !== undefined) {
         instance.date = new Date(date);
         await instance.save();
      }

      try { getIO().to(`plan_${instance.plan}`).emit("task_updated", instance); } catch(e){}
      return res.status(200).json({ message: "Series updated", instance });
    }

    res.status(400).json({ message: "Invalid updateType. Must be 'single' or 'future'." });
  } catch(error) {
    res.status(500).json({ message: "Server error" });
  }
}

async function getTaskTemplates(req, res) {
  try {
    const { planId } = req.params;
    const userId = req.user.id;
    
    // Check if the user is a member of the plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    
    if (!plan.members.includes(userId)) {
      return res.status(403).json({ message: "Not authorized to access tasks in this plan" });
    }

    const templates = await Task.find({ plan: planId })
      .populate("createdBy", "username")
      .populate("assignedTo", "username")
      .sort({ createdAt: -1 });
      
    res.status(200).json({
      message: "Task templates fetched",
      templates
    });
  } catch(error) {
    console.log("[getTaskTemplates error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}


async function scheduleTaskInstances(req, res) {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const { startDate, endDate, assignedTo } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task template not found" });

    const plan = await Plan.findById(task.plan);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    if (!plan.members.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const targets = (assignedTo && assignedTo.length > 0)
      ? assignedTo
      : task.assignedTo.map(id => id.toString());

    if (!targets || targets.length === 0) {
      return res.status(400).json({ message: "No members to schedule for" });
    }

    const memberIds = plan.members.map(id => id.toString());
    const invalid = targets.filter(id => !memberIds.includes(id.toString()));
    if (invalid.length > 0) {
      return res.status(400).json({ message: "Some selected members are not in this plan" });
    }

    let current = new Date(startDate);
    const end = new Date(endDate);
    const interval = task.recurrence?.isRecurring ? (task.recurrence.interval || 1) : 1;
    const rType = task.recurrence?.type || "daily";
    const created = [];

    while (current <= end) {
      const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(current); dayEnd.setHours(23, 59, 59, 999);

      for (const memberId of targets) {
        const exists = await TaskInstance.findOne({
          task: taskId,
          assignedTo: memberId,
          date: { $gte: dayStart, $lte: dayEnd },
        });
        if (!exists) {
          const inst = await TaskInstance.create({
            task: taskId,
            plan: task.plan,
            assignedTo: memberId,
            date: new Date(current),
          });
          created.push(inst);
        }
      }

      if (rType === "weekly") current.setDate(current.getDate() + 7 * interval);
      else if (rType === "monthly") current.setMonth(current.getMonth() + interval);
      else current.setDate(current.getDate() + interval);
    }

    try {
      getIO().to(`plan_${task.plan}`).emit("task_created", { taskId, count: created.length });
    } catch (e) {}

    return res.status(201).json({ message: `${created.length} instance(s) scheduled`, count: created.length });
  } catch (error) {
    console.log("[scheduleTaskInstances error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function getPlanLog(req, res) {
  try {
    const { planId } = req.params;
    const userId = req.user.id;
    const instances = await TaskInstance.find({ plan: planId, assignedTo: userId })
      .populate("task", "title createdAt recurrence priority")
      .sort({ date: 1 });
    res.status(200).json({ message: "Plan log fetched successfully", instances });
  } catch (error) {
    console.log("[getPlanLog error]:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createTask,
  completeTask,
  getPendingTasks,
  getCompletedTasks,
  getAllTasks,
  deleteTask,
  deleteTaskInstance,
  addUploadedFile,
  updateTask,
  rescheduleTaskInstance,
  editTaskInstance,
  getCalendarTasks,
  searchTasks,
  getTaskTemplates,
  scheduleTaskInstances,
  getPlanLog,
};

