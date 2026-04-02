const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const taskContoller = require("../controllers/task.controller");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/postTask/:planId", protect, taskContoller.createTask);
router.post("/taskComplete/:taskId", protect, taskContoller.completeTask);
router.get("/get/pendingTasks",protect, taskContoller.getPendingTasks);
router.get("/get/completedTasks",protect, taskContoller.getCompletedTasks);
router.get("/get/all-tasks", protect, taskContoller.getAllTasks);

router.delete("/delete/:taskId",protect,taskContoller.deleteTask);
router.delete("/delete-instance/:instanceId", protect, taskContoller.deleteTaskInstance);

router.post("/upload/image", protect, upload.array("images", 10), taskContoller.addUploadedFile);

router.put("/update/:taskId", protect, taskContoller.updateTask);
router.put("/edit-instance/:instanceId", protect, taskContoller.editTaskInstance);
router.patch("/reschedule/:instanceId", protect, taskContoller.rescheduleTaskInstance);

router.get("/get/calendar", protect, taskContoller.getCalendarTasks);
router.get("/search", protect, taskContoller.searchTasks);

module.exports = router;
