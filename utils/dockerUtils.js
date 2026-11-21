import Docker from "dockerode";
import path from "node:path";
import fse from "fs-extra";
import AppError from "./AppError.js";
import getRunningContainers from "./helper_fns/runningContainers.js";
import { runTraefik } from "./helper_fns/runTraefik.js";
import { pullDockerImage } from "./helper_fns/pullDockerImage.js";
import runFrameworkContainer from "./helper_fns/runFrameworkContainer.js";
import imageMap from "./helper_fns/dockerImage.js";
import buildRunner from "../Dockerfiles/index.js";

const docker = new Docker();

export const startContainer = async (socket, language, framework, project) => {
  const dockerImage = framework ? imageMap[framework] : imageMap[language];

  if (!dockerImage) {
    socket.emit("containerStarted", { success: false, message: "No container needed for static project" });
    framework && socket.emit("serverStatus", { running: false, liveServer: null });
    return null;
  }

  // 1️⃣ Ensure user project folder exists and copy from demo folder if empty
  try {
    const userFolder = path.join(process.env.ROOT_VOL_DIR, socket.user.username);
    const projectFolder = path.join(userFolder, project);
    const templateType = framework || language || "express";
    const demoFolder = path.join(process.env.ROOT_VOL_DIR, "demo", templateType);

    await fse.ensureDir(projectFolder);
    const files = await fse.readdir(projectFolder);
    if (files.length === 0 && (await fse.pathExists(demoFolder))) {
      console.log(`📁 Copying demo template from ${demoFolder} to ${projectFolder}...`);
      await fse.copy(demoFolder, projectFolder);
      console.log(`✅ Demo template copied successfully.`);
    }
  } catch (copyErr) {
    console.warn(`⚠️ Warning checking/copying demo folder:`, copyErr.message);
  }

  try {
    const containerName = `${project}_${socket.user.username}`;
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find(c => c.Names.includes(`/${containerName}`));

    if (framework) {
      const runningContainers = await getRunningContainers();
      const runningContainerImages = runningContainers.map(container => container.image);
      const hasTraefik = runningContainerImages.some(image => image.includes('traefik'));
      // if traefik not running
      if (!hasTraefik) {
        const traefikImage = process.env.TRAEFIK_IMAGE || "traefik:v3";
        // need to start/create traefik container
        const images = await docker.listImages().catch(() => []);
        const imageExists = images.some(img =>
          img.RepoTags && img.RepoTags.includes(traefikImage)
        );

        if (!imageExists) {
          console.log(`⬇️ Pulling Docker image: ${traefikImage}...`);
          try {
            await pullDockerImage(traefikImage);
            console.log(`✅ Docker image pulled: ${traefikImage}`);
          } catch (pullErr) {
            console.warn(`⚠️ Could not pull ${traefikImage}:`, pullErr.message);
          }
        }

        // run traefik container for reverse proxy
        await runTraefik().catch((err) => {
          console.warn("⚠️ Traefik start warning:", err.message);
        });
      }
    }


    // if container exists but stopped
    if (existing) {
      const existingContainer = docker.getContainer(existing.Id);
      if (existing.State === "running") {
        console.log(`⚡ Using existing running container: ${containerName}`);
        socket.emit("containerStarted", { success: true, reused: false, framework: framework || null });
        return existingContainer;
      }
      await existingContainer.start();
      console.log(`✅ Reused and started existing container: ${containerName}`);
      socket.emit("containerStarted", { success: true, reused: false, framework: framework || null });
      return existingContainer;
    }

    const images = await docker.listImages().catch(() => []);
    const imageExists = images.some(img =>
      img.RepoTags && img.RepoTags.includes(dockerImage)
    );

    if (!imageExists) {
      // Build local runner image from Dockerfiles, do not pull from dockerhub
      if (Object.values(imageMap).includes(dockerImage)) {
        console.log(`🔨 Building local runner image: ${dockerImage}...`);
        await buildRunner();
      } else {
        console.log(`⬇️ Pulling Docker image: ${dockerImage}...`);
        await pullDockerImage(dockerImage);
      }

      console.log(`✅ Docker image ready: ${dockerImage}`);
    }

    // 2️⃣ Create a new container if not found
    let container;
    if (framework == null) {
      // create new container for non-server project
      container = await docker.createContainer({
        Image: dockerImage,
        name: containerName,
        Cmd: ["sleep", "infinity"],
        Tty: true,
        WorkingDir: "/usr/src/app",
        HostConfig: {
          ReadonlyRootfs: true,
          Binds: [
            `${process.env.ROOT_VOL_DIR}/${socket.user.username}/${project}:/usr/src/app`,
          ],
        },
      });
      await container.start();
      socket.emit("containerStarted", { success: true, reused: false, framework: null });
      return container;

    } else {
      console.log("creating container for frame work")
      // create new container for server project
      const username = socket.user.username
      const port = process.env.PORT_FOR_FRAMEWORK

      const container = await runFrameworkContainer({
        dockerImage,
        containerName,
        username,
        project,
        port
      })



      if (container) {
        socket.emit("containerStarted", { success: true, reused: false, framework: framework || null });
        console.log(`✅ Created and started new container: ${containerName}`);
      } else {
        socket.emit("serverStatus", { running: false, liveServer: null });
      }

      return container;

    }

  } catch (err) {
    console.error("❌ Error starting container:", err);

    const message =
      err instanceof AppError
        ? err.message
        : `Failed to start container: ${err.message}`;

    // Otherwise wrap unknown errors
    socket.emit("containerError", { success: false, message });
    return null;

  }
};