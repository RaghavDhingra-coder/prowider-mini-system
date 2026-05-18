import mongoose from "mongoose";

const allocationStateSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    currentIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

allocationStateSchema.index({ serviceId: 1 }, { unique: true });

const AllocationState =
  mongoose.models.AllocationState ||
  mongoose.model("AllocationState", allocationStateSchema);

export default AllocationState;
