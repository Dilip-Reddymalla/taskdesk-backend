const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const taskContoller = require("../controllers/task.controller");

const router = express.Router();

router.post("/postTask/:planId", protect, taskContoller.createTask);
router.post("/taskComplete/:taskId", protect, taskContoller.completeTask);
router.get("/get/pendingTasks",protect, taskContoller.getPendingTasks);
router.get("/get/completedTasks",protect, taskContoller.getCompletedTasks);
router.delete("/delete/:taskId",protect,taskContoller.deleteTask);
router.post("/upload/image",protect,taskContoller.addUploadedFile);
router.put("/update/:taskId", protect, taskContoller.updateTask);
router.patch("/reschedule/:instanceId", protect, taskContoller.rescheduleTaskInstance);

router.get("/get/calendar", protect, taskContoller.getCalendarTasks);
router.get("/search", protect, taskContoller.searchTasks);

module.exports = router;
