const mongoose = require("mongoose");
const { Schema } = mongoose;

const ContractSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    storeName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Referral", "Assist", "Management"],
      required: true,
    },
    commissionRate: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Pending Renewal", "Terminated"],
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ContractSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model("Contract", ContractSchema);
