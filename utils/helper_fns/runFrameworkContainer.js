// runFrameworkContainer.js
import Docker from "dockerode";
const docker = new Docker();

/**
 * Create and start a Docker container with Traefik labels
 * @param {Object} options
 * @param {string} options.dockerImage - Docker image name
 * @param {string} options.containerName - Container name (unique)
 * @param {string} options.username - Username for volume path
 * @param {string} options.project - Project folder name
 * @param {number|string} [options.port=8000] - Internal container port for Traefik
 * @returns {Promise<Docker.Container>}
 */
export default async function runFrameworkContainer({ dockerImage, containerName, username, project, port = 8000 }) {

  const container = await docker.createContainer({
    Image: dockerImage,
    name: containerName,
    Tty: true,
    WorkingDir: "/usr/src/app",
    Cmd: ["sleep", "infinity"],
    Env: ["NODE_ENV=production"],
    Labels: {
      "traefik.enable": "true",
      [`traefik.http.routers.${containerName}.rule`]: `PathPrefix("/${containerName}")`,

      [`traefik.http.services.${containerName}.loadbalancer.server.port`]: `${port}`,

      // Add StripPrefix middleware
      [`traefik.http.routers.${containerName}.middlewares`]:
        `${containerName}-strip`,

      [`traefik.http.middlewares.${containerName}-strip.stripprefix.prefixes`]:
        `/${containerName}`,
        
    },
    HostConfig: {
      NetworkMode: "traefik_net",
      // ReadonlyRootfs: true,
      Binds: [
        `${process.env.ROOT_VOL_DIR}/${username}/${project}:/usr/src/app`,
      ],
    },
  });

  await container.start();
  console.log(`${containerName} container started!`);
  return container;
}
