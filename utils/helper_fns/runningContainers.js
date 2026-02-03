import Docker from "dockerode";

const docker = new Docker();

async function getRunningContainers() {
    try {
        // List all containers
        const containers = await docker.listContainers({ all: true });

        // Delete exited containers
        for (const container of containers) {
            if (container.State === "exited") {
                try {
                    const c = docker.getContainer(container.Id);
                    await c.remove();
                    console.log(`Removed exited container: ${container.Names[0]}`);
                } catch (err) {
                    console.error(`Failed to remove container ${container.Names[0]}:`, err.message);
                }
            }
        }

        // Return only running containers
        const runningContainers = containers
            .filter(container => container.State === "running")
            .map(container => ({
                id: container.Id,
                name: container.Names[0].replace('/', ''),
                image: container.Image,
                status: container.State
            }));

        return runningContainers;

    } catch (error) {
        console.error('Error fetching containers:', error);
        return [];
    }
}

export default getRunningContainers;
