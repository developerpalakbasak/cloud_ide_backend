// pullDockerImage.js
import Docker from "dockerode";
const docker = new Docker();

/**
 * Pull a Docker image and wait until finished
 * @param {string} image - Docker image name (e.g., "traefik:v3")
 * @returns {Promise<void>}
 */
export async function pullDockerImage(image) {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);

      docker.modem.followProgress(
        stream,
        (err, output) => {
          if (err) return reject(err);
          console.log(`Image ${image} pulled successfully.`);
          resolve(output);
        }
      );
    });
  });
}
