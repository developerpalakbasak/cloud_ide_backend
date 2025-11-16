import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import Project from "../models/project.model.js";
import slugify from "slugify";
import fse from "fs-extra";
import catchAsync from "../utils/catchAsync.js";
import { generateFileTree } from "../utils/generateFileTree.js";
import AppError from "../utils/AppError.js";

const ROOT_VOL_DIR = process.env.ROOT_VOL_DIR;

export const getTree = catchAsync(async (req, res, next) => {
  const projectDir = path.join(ROOT_VOL_DIR, req.user.username, req.params.project);
  const exists = await fs.stat(projectDir).catch(() => false);

  console.log("get tree");

  if (!exists) return next(new AppError("Project not found", 404));

  const tree = await generateFileTree(projectDir);
  res.status(200).json({ success: true, tree });
});


/* ============================================================
   ✅ UPDATED createLanguageProject FUNCTION
============================================================ */
export const createLanguageProject = catchAsync(async (req, res, next) => {
  const { name, language } = req.body;
  const user = req.user;

  if (!language) return next(new AppError("Language is required", 400));
  if (!name) return next(new AppError("Project name is required", 400));

  // 🔥 Ensure ROOT_VOL_DIR exists
  try {
    await fse.ensureDir(ROOT_VOL_DIR);
  } catch (err) {
    return next(new AppError("Failed to initialize root volume directory", 500));
  }

  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (await Project.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const userFolder = path.join(ROOT_VOL_DIR, user.username);
  const projectFolder = path.join(userFolder, slug);
  const demoFolder = path.join(ROOT_VOL_DIR, "demo", language || "nodejs");

  const languageEntryScript = {
    nodejs: "index.js",
    typescript: "src/index.ts",
    python: "main.py",
    java: "Main.java",
    "c++": "main.cpp",
    go: "main.go",
    php: "index.php",
  };

  const entryFile = languageEntryScript[language];
  if (!entryFile) return next(new AppError("Unsupported language", 400));

  const newProject = new Project({
    owner: user.id,
    name,
    slug,
    language,
    status: "stopped",
    entryFile,
    volumePath: projectFolder,
  });

  await newProject.save();

  // 🔥 Ensure user folder exists
  await fse.ensureDir(userFolder);

  // 🔥 Ensure demo folder exists
  if (!(await fse.pathExists(demoFolder))) {
    return next(new AppError(`Demo folder missing for language: ${language}`, 500));
  }

  // 🔥 Copy demo template → project folder
  await fse.copy(demoFolder, projectFolder);

  res.status(201).json({
    success: true,
    message: "Project created successfully",
    project: newProject,
  });
});
/* ============================================================ */


export const deleteProject = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;

  if (!id) return next(new AppError("Bad Request", 400));
  const project = await Project.findById(id);
  if (!project) return next(new AppError("Project not found", 404));

  if (project.owner.toString() !== user.id) {
    return next(new AppError("Unauthorized", 401));
  }

  if (project.volumePath) {
    try {
      await fse.remove(project.volumePath);
      console.log("Folder deleted:", project.volumePath);
    } catch (err) {
      console.error("Error deleting folder:", err);
      return next(new AppError("Failed to delete", 401));
    }
  }
  await Project.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Project and folder deleted successfully",
  });
});


export const createFrameworkProject = catchAsync(async (req, res, next) => {
  const { name, framework, language } = req.body;
  const user = req.user;
  console.log(name, framework);

  if (!framework) return next(new AppError("Framework is required", 400));
  if (!language) return next(new AppError("Language is required", 400));
  if (!name) return next(new AppError("Project name is required", 400));

  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;

  let counter = 1;

  while (await Project.findOne({ slug, owner: user.id })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const userFolder = path.join(ROOT_VOL_DIR, user.username);
  const projectFolder = path.join(userFolder, slug);
  const demoFolder = path.join(ROOT_VOL_DIR, "demo", framework);

  const frameworkEntryScript = {
    express: "node index.js",
  };

  const entryFile = frameworkEntryScript[framework];

  const newProject = new Project({
    owner: user.id,
    name,
    slug,
    framework,
    language,
    status: "stopped",
    entryFile,
    volumePath: projectFolder,
  });

  await newProject.save();

  await fse.ensureDir(userFolder);
  await fse.copy(demoFolder, projectFolder);

  res.status(201).json({
    success: true,
    message: "Project created successfully",
    slug,
    project: newProject,
  });
});


export const getAllProject = catchAsync(async (req, res, next) => {
  const projects = await Project.find({ owner: req.user.id });
  if (!projects) return next(new AppError("Projects are not found", 404));
  res.status(200).json({ success: true, projects });
});


export const getProjectFromSlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const { user } = req;

  const project = await Project.findOne({ owner: user.id, slug });
  if (!project) return next(new AppError("Project not found", 404));
  res.status(200).json({ success: true, project });
});


export const getTreeFromSlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const { user } = req;

  const project = await Project.findOne({ owner: user.id, slug });
  if (!project) return next(new AppError("Project not found", 404));

  const exists = await fs.stat(project.volumePath).catch(() => false);
  if (!exists) return next(new AppError("Project not exists", 404));

  const tree = await generateFileTree(project.volumePath);
  if (!tree) return next(new AppError("Project not exists", 404));

  const language = project?.language;
  const framework = project?.framework;
  const entryFile = project.entryFile;

  res.json({ language, framework, entryFile, tree });
});


export const getFileCodes = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const relativePath = req.query.path;

  if (!relativePath) return next(new AppError("No file specified", 400));

  const project = await Project.findOne({ owner: req.user.id, slug });
  if (!project) return next(new AppError("Project not found", 404));

  const filePath = path.join(project.volumePath, relativePath);

  const stat = await fs.stat(filePath).catch(() => false);
  if (!stat || !stat.isFile()) {
    return next(new AppError("File not found", 404));
  }

  const content = await fs.readFile(filePath, "utf-8");

  if (content === undefined || content === null) {
    return next(new AppError("Error during readfile", 500));
  }

  res.status(200).json({
    success: true,
    filename: relativePath,
    content,
  });
});


export const saveMultipleFiles = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const { files } = req.body;

  if (!files || Object.keys(files).length === 0) {
    return next(new AppError("No files to save", 400));
  }

  const project = await Project.findOne({ owner: req.user.id, slug });
  if (!project) return next(new AppError("Project not found", 404));

  const results = [];

  for (const [relativePath, code] of Object.entries(files)) {
    const filePath = path.join(project.volumePath, relativePath);

    try {
      await fs.writeFile(filePath, code, "utf-8");
      results.push({ file: relativePath, status: "saved" });
    } catch (err) {
      results.push({
        file: relativePath,
        status: "error",
        message: err.message,
      });
    }
  }

  res.json({ success: true, results });
});


export const deleteSingleFile = catchAsync(async (req, res, next) => {
  const { target } = req.query;
  const { slug } = req.params;
  const { user } = req;

  if (!target) return next(new AppError("File path is required", 400));

  const absolutePath = path.join(ROOT_VOL_DIR, user.username, slug, target);

  const normalizedRoot = path.resolve(ROOT_VOL_DIR);
  const normalizedAbsolute = path.resolve(absolutePath);

  const relative = path.relative(normalizedRoot, normalizedAbsolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return next(new AppError("Invalid file path", 400));
  }

  try {
    const stats = await fs.stat(normalizedAbsolute);
    let message;
    if (stats.isDirectory()) {
      await fse.remove(normalizedAbsolute);
      message = "Folder Removed";
    } else {
      await fs.unlink(normalizedAbsolute);
      message = "File Deleted";
    }

    res.status(200).json({
      success: true,
      message,
      deleted: target,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return next(new AppError("File not found", 404));
    }
    return next(err);
  }
});


export const createNew = catchAsync(async (req, res, next) => {
  const { target, type, name } = req.query;
  const { slug } = req.params;
  const { user } = req;

  let targetDir = target || "";

  const absolutePath = path.join(
    ROOT_VOL_DIR,
    user.username,
    slug,
    targetDir,
    name
  );

  try {
    const exists = await fse.pathExists(absolutePath);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `${type} already exists`,
      });
    }

    if (type === "folder") {
      await fse.ensureDir(absolutePath);
    } else if (type === "file") {
      const parentDir = path.dirname(absolutePath);
      await fse.ensureDir(parentDir);
      await fse.writeFile(absolutePath, "", "utf8");
    }

    res.status(200).json({
      success: true,
      message: `${type} created successfully`,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return next(new AppError("Wrong directory", 404));
    }
    return next(err);
  }
});


export const editEntryFile = catchAsync(async (req, res, next) => {
  const { entryFile } = req.body;
  const { slug } = req.params;
  const { user } = req;

  const project = await Project.findOneAndUpdate(
    { owner: user.id, slug },
    { $set: { entryFile } },
    { new: true }
  );
  if (!project) return next(new AppError("Project not found", 404));

  res.status(200).json({
    success: true,
    message: "Script updated",
  });
});