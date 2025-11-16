// runTraefik.js
import Docker from "dockerode";
const docker = new Docker();

/**
 * Start Traefik container with predefined settings
 * @returns {Promise<Docker.Container>}
 */
export async function runTraefik() {
  const containerName = "traefik";

  const TRAEFIK_PORT = process.env.TRAEFIK_HOST_PORT || "80";

  const containers = await docker.listContainers({ all: true });
  const existing = containers.find(c => c.Names.includes(`/${containerName}`));

  if (existing) {
    const container = docker.getContainer(existing.Id);
    await container.start().catch(() => {});
    // console.log("Traefik container already exists. Started if it was stopped.");
    return container;
  }

  // Create Traefik container
  const container = await docker.createContainer({
    Image: "traefik:v3",
    name: containerName,

    Cmd: [
      `--entrypoints.web.address=:${TRAEFIK_PORT}`,
      "--providers.docker",
      "--api=false" 
    ],

    HostConfig: {
      NetworkMode: "traefik_net",
      Binds: ["/var/run/docker.sock:/var/run/docker.sock"],

      PortBindings: {
        [`${TRAEFIK_PORT}/tcp`]: [{ HostPort: TRAEFIK_PORT }]
      }
    },

    ExposedPorts: {
      [`${TRAEFIK_PORT}/tcp`]: {}
    }
  });

  await container.start();
  console.log(`Traefik started on port ${TRAEFIK_PORT}!`);
  return container;
}
