const userModel = require("../models/user.model");
const inviteModel = require("../models/invite.model");
const notificationModel = require("../models/notification.model");
const planModel = require("../models/plan.model");

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
    if (plan.members.includes(reciver._id)) {
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
      relatedId: planID,
    });
    res.status(201).json({
      message: "Invite send succsefully",
      invite,
      notification,
    });
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
      res.status(200).json({
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
async function acceptInvite(req, res) {
  try {
    const userId = req.user.id;
    const inviteId = req.params.inviteId;
    const { planId } = req.body;
    if (!inviteId) {
      return res.status(400).json({ message: "invite id required" });
    }
    if (!planId) {
      return res.status(409).json({ message: "plan id required" });
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
    const plan = await planModel.findById(planId);
    if (!plan) return res.status(404).json({ message: "plan not found" });
    if (plan.owner.toString() !== invite.sender.toString())
      return res.status(403).json({
        message: "The invite should be send from the owner of the plan",
      });
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
    res.status(200).json({ message: "invite accepted" });
  } catch (error) {
    console.log("[invite controller]:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
module.exports = { sendInvite, getPendingInvites, acceptInvite };
