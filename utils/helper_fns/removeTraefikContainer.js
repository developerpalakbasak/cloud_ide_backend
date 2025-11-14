import Docker from "dockerode"
import getRunningContainers from "./runningContainers.js";

const docker = Docker()

export async function removeTraefikContainer(socket) {
    const runningContainers = await getRunningContainers();
    const runningContainerImages = runningContainers.map(container => container.image);

    const traefikContainer = runningContainers.find(
        container => container.image && container.image.includes("traefik")
    );
    const expressContainer = runningContainers.find(
        container => container.image && container.image.includes("express")
    );

    if (socket.framework && runningContainerImages.length <= 2 && traefikContainer && !expressContainer) {
        await stopAndRemoveContainer(traefikContainer.id)
    }


}



async function stopAndRemoveContainer(containerId) {
    try {
        const container = docker.getContainer(containerId);

        // Stop the container if running
        const data = await container.inspect();
        if (data.State.Running) {
            await container.stop();
            console.log(`Container ${containerId} stopped.`);
        }

        // Remove the container
        await container.remove({ force: true });
        console.log(`Container ${containerId} removed.`);
    } catch (err) {
        console.error(`Failed to stop/remove container ${containerId}:`, err.message);
    }
}