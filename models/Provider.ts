import mongoose from "mongoose";

const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    monthlyQuota: {
      type: Number,
      default: 10,
      min: 0,
    },
    leadsReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

const Provider = mongoose.models.Provider || mongoose.model("Provider", providerSchema);

export default Provider;
