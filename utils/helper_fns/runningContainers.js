import Docker from "dockerode";

const docker = new Docker();

// Make it an async function since docker.listContainers is async
async function getRunningContainers() {
    try {
        const containers = await docker.listContainers({ all: true });

        return containers.map(container => ({
            id: container.Id,
            name: container.Names[0].replace('/', ''), // Remove leading slash
            image: container.Image,
            status: container.State
        }));
    } catch (error) {
        console.error('Error fetching containers:', error);
        return [];
    }
}

// Export the function
export default getRunningContainers;