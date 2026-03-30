const planModel = require("../models/plan.model");
const userModel = require("../models/user.model");
const TaskInstance = require("../models/taskInstance.model");
const slugify = require("slugify");
const { nanoid } = require("nanoid");

async function createPlan(req, res) {
  try {
    let { title, description, owner, members } = req.body;
    if (!owner) {
      owner = req.user.id;
    }
    if (!members) {
      members = [req.user.id];
    }
    if (req.user.status === "banned") {
      return res.status(403).json({
        message: "You are banned from creating",
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "Title and content are required",
      });
    }

    for (let member of members) {
      const userExists = await userModel.findById(member);
      if (!userExists) {
        return res.status(401).json({
          message: "Invalid member user id",
        });
      }
    }

    const slug = `${slugify(title, { lower: true, strict: true })}-${nanoid(6)}`;

    const newPlan = await planModel.create({
      title: title,
      slug: slug,
      description: description,
      owner: owner,
      members: members,
    });

    res.status(201).json({
      message: "Plan created successfully",
      plan: newPlan,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
}

async function deletePlan(req, res) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(401).json({
        message: "Enter the sulg id of the plan",
      });
    }
    const plan = await planModel.findOne({ slug });
    if (!plan) {
      return res.status(404).json({
        message: "Plan not found",
      });
    }
    if (plan.owner.toString() !== req.user.id) {
      return res.status(401).json({
        message: "not authorized to delete the plan",
      });
    }

    await plan.deleteOne();

    return res.status(201).json({
      message: "Plan deleted",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
}

async function updatePlanStreak(planId) {
  const plan = await planModel.findById(planId);

  if (!plan) {
    console.log("Plan not found:", planId);
    return;
  }

  const today = new Date().toDateString();
  const last = plan.lastCompletedDate
    ? new Date(plan.lastCompletedDate).toDateString()
    : null;

  if (last === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (last === yesterday.toDateString()) {
    plan.streakCount += 1;
  } else {
    plan.streakCount = 1;
  }

  plan.lastCompletedDate = new Date();

  await plan.save();
}

async function updateUserStreak(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasCompleted = await TaskInstance.exists({
    assignedTo: userId,
    date: today,
    isCompleted: true,
  });

  if (!hasCompleted) {
    return;
  }

  const user = await userModel.findById(userId);

  const todayStr = new Date().toDateString();
  const last = user.lastActiveDate
    ? new Date(user.lastActiveDate).toDateString()
    : null;

  if (last === todayStr) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (last === yesterday.toDateString()) {
    user.streakCount += 1;
  } else {
    user.streakCount = 1;
  }

  user.lastActiveDate = new Date();

  await user.save();
}

async function getUserPlans(req, res) {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({
        message: "Invalid user",
      });
    }
    const plans = await planModel.find({ owner: userId });
    if (!plans || plans.length === 0) {
      return res.status(404).json({
        message: "No plans found in userID",
      });
    }
    res.status(200).json({
      message: "Fetched plans in the userID",
      length: plans.length,
      plans,
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
}

module.exports = {
  createPlan,
  deletePlan,
  updatePlanStreak,
  updateUserStreak,
  getUserPlans,
};
