// runTraefik.js
import Docker from "dockerode";
const docker = new Docker();

/**
 * Start Traefik container with predefined settings
 * @returns {Promise<Docker.Container>}
 */
export async function runTraefik() {
  const containerName = "traefik";

  // Check if container already exists
  const containers = await docker.listContainers({ all: true });
  const existing = containers.find(c => c.Names.includes(`/${containerName}`));
  if (existing) {
    const container = docker.getContainer(existing.Id);
    await container.start().catch(() => {}); // ignore if already running
    console.log("Traefik container already exists. Started if it was stopped.");
    return container;
  }

  // Create and start Traefik container
  const container = await docker.createContainer({
    Image: "traefik:v3",
    name: containerName,
    Tty: false,
    Cmd: [
      "--entrypoints.web.address=:80",
      "--api.insecure=true",
      "--providers.docker"
    ],
    HostConfig: {
      NetworkMode: "traefik_net",
      Binds: ["//var/run/docker.sock:/var/run/docker.sock"],
      PortBindings: {
        "80/tcp": [{ HostPort: "80" }],
        "8080/tcp": [{ HostPort: "8080" }]
      }
    },
    ExposedPorts: {
      "80/tcp": {},
      "8080/tcp": {}
    }
  });

  await container.start();
  console.log("Traefik container started!");
  return container;
}
