const mongoose = require("mongoose");
const { Schema } = mongoose;

const VendorSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Vendor must belong to an organization"],
      index: true,
    },
    type: {
      type: String,
      enum: ["Person", "Organization"],
      default: "Organization",
    },
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Vendor email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Vendor phone is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Vendor address is required"],
    },
    paymentDetails: {
      bankName: { type: String, required: true },
      accNo: { type: String, required: true },
      ifsc: { type: String, required: true },
      bankAddress: { type: String, required: true },
      panNo: { type: String, required: true },
    },
    documentVerification: {
      aadhaar: { type: String, default: null },
      pan: { type: String, required: true },
      gstin: { type: String, default: null },
    },
    capability: [
      {
        type: String,
        enum: ["Referral", "Assist", "Management"],
      },
    ],
    capabilityStartDate: {
      type: Date,
      default: null,
    },
    capabilityEndDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

VendorSchema.index({ organizationId: 1, email: 1 });

module.exports = mongoose.model("Vendor", VendorSchema);
