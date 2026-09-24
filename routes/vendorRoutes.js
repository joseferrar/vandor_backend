const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// Admins and Super Admins can manage vendors
router.use(authenticate, authorize("superAdmin", "admin"), tenantMiddleware);

router.get("/", vendorController.getVendors);
router.post("/", vendorController.createVendor);
router.get("/:id", vendorController.getVendorById);
router.put("/:id", vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);
router.patch("/:id/status", vendorController.updateVendorStatus);

module.exports = router;
