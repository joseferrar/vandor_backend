const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: 255,
    },
    code: {
      type: String,
      required: [true, "Organization code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    // Strictly 1:1 relationship with Admin user
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Designated Admin user reference is required"],
      unique: true, // Guarantees 1 Admin has 1 Org, and 1 Org has 1 Admin
      index: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

OrganizationSchema.virtual("admin", {
  ref: "User",
  localField: "adminId",
  foreignField: "_id",
  justOne: true,
});

OrganizationSchema.virtual("vendorCount", {
  ref: "Vendor",
  localField: "_id",
  foreignField: "organizationId",
  count: true,
});

module.exports = mongoose.model("Organization", OrganizationSchema);
