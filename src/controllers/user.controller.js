const userModel = require("../models/user.model");

async function getProfileInfo(req, res) {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(404).json({ message: "user id required" });
    }
    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).message({ message: "User not found" });
    }
    res.status(200).json({
      message: "user found",
      user,
    });
  } catch (error) {
    console.log("[user controller:]", error);
    return res.status(500).json({ message: "server error" });
  }
}


module.exports = {getProfileInfo};