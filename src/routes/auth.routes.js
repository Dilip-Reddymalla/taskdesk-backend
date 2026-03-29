const express = require("express");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register",authController.registerUser);
router.post("/login", authController.loginUser);
router.delete("/deleteUser",protect, authController.deleteUser);

module.exports = router;
