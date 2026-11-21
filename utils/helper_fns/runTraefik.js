// runTraefik.js
import Docker from "dockerode";
const docker = new Docker();

/**
 * Start Traefik container with predefined settings
 * @returns {Promise<Docker.Container>}
 */
export async function runTraefik() {
  const containerName = "traefik";

  const TRAEFIK_PORT = process.env.TRAEFIK_HOST_PORT || "5000";

  // Ensure traefik_net network exists
  const networks = await docker.listNetworks().catch(() => []);
  const hasNet = networks.some(n => n.Name === "traefik_net");
  if (!hasNet) {
    try {
      await docker.createNetwork({ Name: "traefik_net", Driver: "bridge" });
      console.log("Created docker network: traefik_net");
    } catch (netErr) {
      console.warn("Could not create traefik_net network:", netErr.message);
    }
  }

  const containers = await docker.listContainers({ all: true });
  const existing = containers.find(c => c.Names.includes(`/${containerName}`));

  if (existing) {
    const container = docker.getContainer(existing.Id);
    if (existing.State === "running") {
      return container;
    }
    try {
      await container.start();
      console.log("Traefik container started from existing.");
      return container;
    } catch (err) {
      console.warn("Existing Traefik container failed to start, recreating:", err.message);
      await container.remove({ force: true }).catch(() => {});
    }
  }

  const traefikImage = process.env.TRAEFIK_IMAGE || "traefik:v3";

  // Create Traefik container: Traefik listens on :80 internally, mapped to TRAEFIK_PORT on host
  const container = await docker.createContainer({
    Image: traefikImage,
    name: containerName,

    Cmd: [
      "--entrypoints.web.address=:80",
      "--providers.docker=true",
      "--providers.docker.exposedbydefault=false",
      "--providers.docker.network=traefik_net",
    ],

    HostConfig: {
      NetworkMode: "traefik_net",
      Binds: ["/var/run/docker.sock:/var/run/docker.sock"],

      PortBindings: {
        "80/tcp": [{ HostPort: String(TRAEFIK_PORT) }],
      },
      RestartPolicy: {
        Name: "unless-stopped",
      },
    },

    ExposedPorts: {
      "80/tcp": {},
    },
  });

  await container.start();
  console.log(`Traefik started and listening on host port ${TRAEFIK_PORT}!`);
  return container;
}
