const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const taskContoller = require("../controllers/task.controller");

const router = express.Router();

router.post("/postTask/:planId", protect, taskContoller.createTask);
router.post("/taskComplete/:taskId", protect, taskContoller.completeTask);
router.get("/get/pendingTasks",protect, taskContoller.getPendingTasks);
router.get("/get/completedTasks",protect, taskContoller.getCompletedTasks);


module.exports = router;
