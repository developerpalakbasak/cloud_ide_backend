import Docker from "dockerode";
import AppError from "./AppError.js";
import getRunningContainers from "./helper_fns/runningContainers.js";
import { runTraefik } from "./helper_fns/runTraefik.js";
import { pullDockerImage } from "./helper_fns/pullDockerImage.js";
import runFrameworkContainer from "./helper_fns/runFrameworkContainer.js";

const docker = new Docker();

export const startContainer = async (socket, language, framework, project) => {
  const imageMap = {
    nodejs: "node:20-alpine",
    typescript: "node:20-ts",
    python: "python:3.12-alpine",
    java: "openjdk:20",
    express: "express-runner:latest",
    "html-css-js": null,
  };

  const dockerImage = framework ? imageMap[framework] : imageMap[language];

  if (!dockerImage) {
    socket.emit("containerStarted", { success: false, message: "No container needed for static project" });
    framework && socket.emit("serverStatus", { running: false, liveServer: null });
    return null;
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

        const dockerImage = "traefik:v3"
        // need to start/create traefik container
        const images = await docker.listImages();
        const imageExists = images.some(img =>
          img.RepoTags && img.RepoTags.includes(dockerImage)
        );

        if (!imageExists) {
          console.log(`⬇️ Pulling Docker image: ${dockerImage}...`);
          await pullDockerImage(dockerImage);
          console.log(`✅ Docker image pulled: ${dockerImage}`);
        }

        // run traefik container for reverse proxy
        await runTraefik();
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

    const images = await docker.listImages();
    const imageExists = images.some(img =>
      img.RepoTags && img.RepoTags.includes(dockerImage)
    );

    if (!imageExists) {
      console.log(`⬇️ Pulling Docker image: ${dockerImage}...`);
      await pullDockerImage(dockerImage)
      console.log(`✅ Docker image pulled: ${dockerImage}`);
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