const express = require("express");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register",authController.registerUser);
router.post("/login", authController.loginUser);
router.delete("/deleteUser",protect, authController.deleteUser);
router.get("/me", protect, authController.verifyToken);

//Oauth routes
router.post('/google',authController.googleLogin);

module.exports = router;
