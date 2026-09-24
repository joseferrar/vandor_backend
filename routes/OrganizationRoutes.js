const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// All organization management is reserved for Super Admin
router.use(authenticate, authorize("superAdmin"));

router.get("/", organizationController.getOrganizations);
router.post("/", organizationController.createOrganization);
router.get("/:id", organizationController.getOrganizationById);
router.put("/:id", organizationController.updateOrganization);
router.delete("/:id", organizationController.deleteOrganization);
router.post("/:id/reassign-admin", organizationController.reassignAdmin);

module.exports = router;
