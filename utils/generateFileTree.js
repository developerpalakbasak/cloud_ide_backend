// utils/generateFileTree.js
import fs from "fs/promises";
import path from "path";

export async function generateFileTree(directory) {
  const tree = {};

  async function buildTree(currentDir, currentTree) {
    const files = await fs.readdir(currentDir, { withFileTypes: true });

    for (const dirent of files) {
      const fileName = dirent.name;
      if (fileName === "node_modules" || fileName === ".git" || fileName === "start.sh" || fileName === "stop.sh" || fileName === "restart.sh" || fileName === "nodemon.pid") continue;

      const fullPath = path.join(currentDir, fileName);

      if (dirent.isDirectory()) {
        currentTree[fileName] = {};
        await buildTree(fullPath, currentTree[fileName]);
      } else if (dirent.isFile()) {
        currentTree[fileName] = null;
      }
    }
  }

  await buildTree(directory, tree);
  return tree;
}
