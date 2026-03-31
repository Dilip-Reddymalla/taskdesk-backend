const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const inviteContoller = require("../controllers/invite.controller");

const router = express.Router();

router.post("/send",protect,inviteContoller.sendInvite);
router.get("/pending",protect,inviteContoller.getPendingInvites);
router.post("/accept/:inviteId",protect,inviteContoller.acceptInvite);