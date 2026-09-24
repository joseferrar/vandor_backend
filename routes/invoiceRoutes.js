const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authenticate = require("../middleware/authMiddleware");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.use(authenticate, tenantMiddleware);

router.get("/", invoiceController.getInvoices);
router.post("/", invoiceController.createInvoice);
router.patch("/:id/status", invoiceController.updateInvoiceStatus);

module.exports = router;
