// services/fileService.js
import fs from "fs/promises";
import path from "path";
import Project from "../models/project.model.js";

export async function saveFilesForProject(userId, slug, files) {
  if (!files || Object.keys(files).length === 0) {
    throw new Error("No files to save");
  }

  const project = await Project.findOne({ owner: userId, slug });
  if (!project) throw new Error("Project not found");

  const results = [];

  for (const [relativePath, code] of Object.entries(files)) {
    const filePath = path.join(project.volumePath, relativePath);

    try {
      await fs.writeFile(filePath, code, "utf-8");
      results.push({ file: relativePath, status: "saved" });
    } catch (err) {
      results.push({ file: relativePath, status: "error", message: err.message });
    }
  }

  return results;
}
