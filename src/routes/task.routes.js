const express = require("express");
const { protect } = require("../middleware/auth.middleware");

const taskContoller = require("../controllers/task.controller");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Template routes (Task document / blueprint) ──────────────
router.post("/template/create/:planId", protect, taskContoller.createTask);          // Create a new task template
router.get("/template/get/:planId", protect, taskContoller.getTaskTemplates);        // Get all templates for a plan
router.put("/template/update/:taskId", protect, taskContoller.updateTask);           // Edit a template
router.delete("/template/delete/:taskId", protect, taskContoller.deleteTask);        // Delete template + all its instances

// ── Instance routes (TaskInstance documents) ──────────────────
router.post("/instance/schedule/:taskId", protect, taskContoller.scheduleTaskInstances); // Create instances from a template
router.post("/instance/complete/:taskId", protect, taskContoller.completeTask);          // Mark an instance complete
router.put("/instance/edit/:instanceId", protect, taskContoller.editTaskInstance);       // Edit a specific instance
router.patch("/instance/reschedule/:instanceId", protect, taskContoller.rescheduleTaskInstance); // Move instance to new date
router.delete("/instance/delete/:instanceId", protect, taskContoller.deleteTaskInstance);        // Delete a single instance

// ── Fetch / query instances ───────────────────────────────────
router.get("/get/pendingTasks", protect, taskContoller.getPendingTasks);
router.get("/get/completedTasks", protect, taskContoller.getCompletedTasks);
router.get("/get/all-tasks", protect, taskContoller.getAllTasks);
router.get("/get/calendar", protect, taskContoller.getCalendarTasks);
router.get("/search", protect, taskContoller.searchTasks);
router.get("/instance/log/:planId", protect, taskContoller.getPlanLog);

// ── Attachments ───────────────────────────────────────────────
router.post("/upload/image", protect, upload.array("images", 10), taskContoller.addUploadedFile);

module.exports = router;
