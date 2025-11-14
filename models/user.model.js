import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    bio: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      select: false, // exclude from queries unless explicitly selected
    },

    avatar: {
      type: String,
      default: null, // for GitHub profile picture
    },

    provider: {
      type: String, // e.g., "github", "google", etc.
      default: null,
    },

    oauthId: {
      type: String, // GitHub user ID (string from GitHub API)
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);


// Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
  const refreshToken = jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET_REFRESH_TOKEN,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE }
  );
  return refreshToken;
};



// Generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      name: this.name,
      avatar: this.avatar,
      username: this.username,
      isVerified: this.isVerified,
      provider: this.provider,
      bio: this.bio,
    },
    process.env.JWT_SECRET_ACCESS_TOKEN,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE }
  );
};

// Compare entered password with stored hash
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User 
