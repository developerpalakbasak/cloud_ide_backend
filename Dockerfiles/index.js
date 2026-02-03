import { exec } from "child_process";
import { promisify } from "util";
import imageMap from "../utils/helper_fns/dockerImage.js";

const execAsync = promisify(exec);

const services = [
  { name: imageMap.nodejs, path: "nodejs-runner" },
  { name: imageMap.express, path: "express-runner" },
  { name: imageMap.python, path: "python-runner" },
  { name: imageMap.typescript, path: "typescript-runner" },
];

export default async function buildRunner() {
  try {
    for (const { name, path } of services) {
      console.log(`🚀 Building ${name}...`);
      await execAsync(`docker build -t ${name} ./Dockerfiles/${path}`);
      console.log(`✅ ${name} built successfully`);
    }

    console.log("🎉 All images built successfully!");
  } catch (error) {
    console.error("❌ Build failed");
    console.error(error.message);
    process.exit(1);
  }
}
