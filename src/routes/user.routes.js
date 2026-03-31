const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const userController = require("../controllers/user.controller");

const router = express.Router();

router.get("/profile",protect, userController.getProfileInfo);