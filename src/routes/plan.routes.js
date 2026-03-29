const express = require("express");
const {protect} = require("../middleware/auth.middleware");

const planContoller = require('../controllers/plan.controller');

const router = express.Router();

router.post("/post",protect,planContoller.createPlan);
router.delete("/delete/:slug",protect,planContoller.deletePlan);


module.exports = router;