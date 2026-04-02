const userModel = require("../models/user.model");
const inviteModel = require("../models/invite.model");
const notificationModel = require("../models/notification.model");
const planModel = require("../models/plan.model");
const { getIO } = require("../socket");

async function sendInvite(req, res) {
  try {
    let { reciverUserName, planID } = req.body;
    let userID = req.user.id;
    if (!reciverUserName) {
      return res
        .status(400)
        .json({ message: "Reciver username is not provided" });
    }
    if (!planID) {
      return res
        .status(400)
        .json({ message: "Plan id is required to send the invite" });
    }
    const reciver = await userModel.findOne({ username: reciverUserName });
    const plan = await planModel.findById(planID);
    if (!reciver) {
      return res
        .status(404)
        .json({ message: "User with this username does not exist" });
    }
    if (reciver._id.toString() === userID) {
      return res.status(400).json({
        message: "You cannot invite yourself",
      });
    }
    if (!plan) {
      return res.status(404).json({ message: "invaild plan id" });
    }
    if (!plan.members.includes(userID)) {
      return res.status(403).json({
        message: "You are not part of this plan",
      });
    }
    if (plan.members.some(member => member.toString() === reciver._id.toString())) {
      return res.status(400).json({
        message: "User is already a member of the plan",
      });
    }
    const existingInvite = await inviteModel.findOne({
      receiver: reciver._id,
      plan: planID,
    });

    if (existingInvite) {
      return res.status(400).json({
        message: "Invite already sent",
      });
    }
    const invite = await inviteModel.create({
      sender: userID,
      receiver: reciver._id,
      plan: planID,
    });
    const notification = await notificationModel.create({
      user: reciver._id,
      type: "invite_received",
      message: `you have recived inivite to a plan by ${req.user.username}`,
      relatedId: invite._id,
    });
    res.status(201).json({
      message: "Invite send succsefully",
      invite,
      notification,
    });

    try {
      getIO().to(`user_${reciver._id}`).emit("invite_received", invite);
    } catch (err) {
      console.log("Socket emit failed", err.message);
    }

  } catch (error) {
    console.log("Server Error", error);
    return res.status(500).json({ message: "Server error" });
  }
}
async function getPendingInvites(req, res) {
  try {
    const userID = req.user.id;
    const invites = await inviteModel
      .find({ receiver: userID, status: "pending" })
      .populate("sender", "username email")
      .populate("plan", "title");
    if (invites.length === 0) {
      return res.status(200).json({
        message: "No pending invites",
        length: 0,
        invites: [],
      });
    }
    res.status(200).json({
      message: "pending invites",
      length: invites.length,
      invites,
    });
  } catch (error) {
    console.log("[invite controller]:", error);
    res.status(500).json({ message: "server error" });
  }
}

async function getAllInvites(req, res) {
  try {
    const userID = req.user.id;
    const invites = await inviteModel
      .find({ receiver: userID })
      .populate("sender", "username email")
      .populate("plan", "title")
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      message: "all invites fetched",
      length: invites.length,
      invites,
    });
  } catch (error) {
    console.log("[invite controller]:", error);
    res.status(500).json({ message: "server error" });
  }
}
async function acceptInvite(req, res) {
  try {
    const userId = req.user.id;
    const inviteId = req.params.inviteId;

    if (!inviteId) {
      return res.status(400).json({ message: "invite id required" });
    }
    if (!userId) {
      return res.status(409).json({ message: "User id required" });
    }
    const invite = await inviteModel.findById(inviteId);
    if (!invite)
      return res.status(404).json({ message: "invite not found on invite id" });
    if (invite.status !== "pending") {
      return res.status(400).json({ message: "invite already used" });
    }
    if (userId.toString() !== invite.receiver.toString()) {
      return res
        .status(409)
        .json({ message: "the invite does not belong to you" });
    }
    
    // Fallback to invite.plan if planId is missing from request body
    const planId = req.body.planId || invite.plan;
    
    const plan = await planModel.findById(planId);
    if (!plan) return res.status(404).json({ message: "plan not found" });

    const alreadyMember = plan.members.some(
      (id) => id.toString() === userId.toString(),
    );

    if (alreadyMember) {
      return res.status(400).json({
        message: "already a member",
      });
    }
    plan.members.push(userId);
    await plan.save();
    invite.status = "accepted";
    await invite.save();

    try {
      getIO().to(`plan_${planId}`).emit("member_joined", { userId });
    } catch (err) {
      console.log("Socket emit failed", err.message);
    }

    res.status(200).json({ message: "invite accepted" });
  } catch (error) {
    console.log("[invite controller]:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
async function rejectInvite(req, res) {
  try {
    const userId = req.user.id;
    const inviteId = req.params.inviteId;
    if (!userId) {
      return res.status(400).json({ message: "user id required" });
    }
    if (!inviteId) {
      return res.status(400).json({ message: "invite id required" });
    }
    const invite = await inviteModel.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: "invite already used" });
    }
    if (userId.toString() !== invite.receiver.toString()) {
      return res
        .status(403)
        .json({ message: "the invite does not belong to you" });
    }
    invite.status = "rejected";
    await invite.save();
    return res.status(200).json({ message: "Invite rejected" });
  } catch (error) {
    console.log("[invite controller:]", error);
    return res.status(500).json({ message: "server error" });
  }
}
module.exports = { sendInvite, getPendingInvites, getAllInvites, acceptInvite, rejectInvite };
