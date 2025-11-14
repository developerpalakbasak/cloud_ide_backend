import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    language: {
      type: String,
      enum: ["nodejs", "javascript", "typescript", "python", "java", "c++", "go", "php", "html-css-js"],
      default: null,
    },
    framework: {
      type: String,
      enum: ["express", "react", "flask", "django"],
      default: null,
    },
    entryFile: {
      type: String,
    },
    port: {
      type: Number, // Exposed port for project
    },
    status: {
      type: String,
      enum: ["running", "stopped", "error"],
      default: "stopped",
    },
    volumePath: {
      type: String, // Local path or Docker volume
    },

    lastRunAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);


