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

module.exports = { sendInvite };
