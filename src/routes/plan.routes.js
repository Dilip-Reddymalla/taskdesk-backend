const express = require("express");
const {protect} = require("../middleware/auth.middleware");

const planContoller = require('../controllers/plan.controller');

const router = express.Router();

router.post("/post",protect,planContoller.createPlan);
router.delete("/delete/:slug",protect,planContoller.deletePlan);
router.get("/get",protect,planContoller.getUserPlans);
router.get("/:planId", protect, planContoller.getPlanById);
router.delete("/:planId/member/:memberId", protect, planContoller.removePlanMember);



module.exports = router;