const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(authenticate, authorize("superAdmin"));

router.get("/", userController.getUsers);
router.post("/", userController.createUser);
router.patch("/:id/status", userController.toggleUserStatus);

module.exports = router;
