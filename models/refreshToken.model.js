import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  device: {
    type: String,
    default: "Unknown Device",
  },
  browser: {
    type: String,
    default: "Unknown Browser",
  },
  ip: {
    type: String,
    default: "Unknown IP",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: Number(process.env.REFRESH_TOKEN_DOCUMENT_VALIDITY) * 24 * 60 * 60, // TTL in seconds
  },
});

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export default RefreshToken;
