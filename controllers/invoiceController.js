const Invoice = require("../models/Invoice");

/**
 * @route   GET /api/invoices
 * @desc    Get invoices scoped by organization
 * @access  Private (Admin, Super Admin, Vendor)
 */
exports.getInvoices = async (req, res) => {
  try {
    const filter = { ...req.tenantFilter };
    const invoices = await Invoice.find(filter)
      .populate("vendorId", "name email")
      .populate("organizationId", "name code")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/invoices
 * @desc    Submit invoice (scoped to organization)
 * @access  Private
 */
exports.createInvoice = async (req, res) => {
  try {
    const { vendorId, storeName, amount, invoiceNumber } = req.body;
    const organizationId = req.user.organizationId || req.body.organizationId;

    if (!organizationId || !vendorId || !amount) {
      return res.status(400).json({
        success: false,
        message: "organizationId, vendorId, and amount are required.",
      });
    }

    const count = await Invoice.countDocuments();
    const invNumber = invoiceNumber || `INV-${1000 + count + 1}`;

    const newInvoice = new Invoice({
      organizationId,
      vendorId,
      storeName: storeName || "Client Store",
      amount,
      invoiceNumber: invNumber,
      status: "Pending",
    });

    await newInvoice.save();

    return res.status(201).json({
      success: true,
      message: "Invoice submitted successfully.",
      data: newInvoice,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   PATCH /api/invoices/:id/status
 * @desc    Update invoice status (Approved, Paid, Pending)
 * @access  Private (Admin, Super Admin)
 */
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const filter = { _id: req.params.id, ...req.tenantFilter };

    const invoice = await Invoice.findOne(filter);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found or unauthorized." });
    }

    invoice.status = status;
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: `Invoice status updated to ${status}.`,
      data: invoice,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
