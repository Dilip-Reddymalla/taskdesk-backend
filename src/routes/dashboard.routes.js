const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/stats", protect, dashboardController.getDashboardStats);

module.exports = router;
