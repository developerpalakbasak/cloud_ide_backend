import { startContainer } from "../utils/dockerUtils.js";
import { saveFilesForProject } from "../utils/saveFiles.js";
import { runCodeHandler } from "../utils/runCodeHandler.js";
import Project from "../models/project.model.js";
import { startTerminalSession } from "../sessions/terminalSessions.js";
import { terminalSessions } from "../states/state.js";
import { removeTraefikContainer } from "../utils/helper_fns/removeTraefikContainer.js";





// helper fn
const serverControls = async (container, sh) => {
    console.log(`executing${sh}`)
    const exec = await container.exec({
        Cmd: ["sh", "-c", `chmod +x /usr/src/app/${sh} && sh /usr/src/app/${sh}`],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: "/usr/src/app",
    });
    return exec
}


export const handleStartContainer = async (socket, userContainers, userConnections, disconnectTimers, language, framework, project) => {
    const key = `${socket.user.id}_${project}`;
    socket.project = project;
    socket.framework = framework || null;

    // Cancel cleanup timer if exists
    if (disconnectTimers.has(key)) {
        console.log("🛑 Canceling container cleanup timer for:", key);
        clearTimeout(disconnectTimers.get(key));
        disconnectTimers.delete(key);
    }

    if (!userConnections.has(key)) userConnections.set(key, new Set());
    userConnections.get(key).add(socket.id);

    if (userContainers.has(key)) {
        socket.emit("containerStarted", { success: true, reuse: true, framework });

        return; // Stop here to avoid creating a new container
    } else {
        const container = await startContainer(socket, language, framework, project);
        userContainers.set(key, container);
        if (container?.id) {
            await Project.findOneAndUpdate(
                { slug: project, owner: socket.user.id },
                { status: "running" }
            );
        }

    }
};


export const handleStartTerminal = async (socket, userContainers, project) => {
    const key = `${socket.user.id}_${project}`;

    const container = userContainers.get(key);
    if (!container) {
        return socket.emit("terminalError", { message: "Container not found" });
    }
    try {
        // Reuse existing terminal session or start a new one
        let terminalSession;
        if (terminalSessions.has(key)) {
            terminalSession = terminalSessions.get(key);
        } else {
            terminalSession = await startTerminalSession(container, socket, key, project);
            terminalSessions.set(key, terminalSession);
        }

        socket.terminalSession = terminalSession;
        socket.emit("terminalStarted", { success: true });
    } catch (err) {
        console.error("Failed to start terminal:", err);
        socket.emit("terminalError", "Failed to start terminal session");
    }


};

export const handleSaveProject = async (socket, project, files) => {
    try {
        const results = await saveFilesForProject(socket.user.id, project, files);
        socket.emit("projectSaved", { success: true, results });
    } catch (err) {
        socket.emit("projectSaved", { success: false, error: err.message });
    }
};


export const handleStartServer = async (socket, userContainers, data) => {
    const key = `${socket.user.id}_${data.project}`;
    // serverError
    const container = userContainers.get(key);
    if (!container) throw new Error("Container not found");
    try {
        const sh = "start.sh"
        const exec = await serverControls(container, sh)

        exec.start({ hijack: true, stdin: false }, (err, stream) => {
            if (err) throw err;
            socket.emit("serverStatus", { running: true, liveServer: `${process.env.PROTOCOL}://${data.project}_${socket.user.username}.${process.env.SERVER_HOST_PREFIX}` });
        });

    } catch (error) {
        console.error("Error restarting container:", error);
        socket.emit("serverStatus", { running: false, liveServer: null });
    }
};


export const handleRestartServer = async (socket, userContainers, data) => {
    const key = `${socket.user.id}_${data.project}`;
    const container = userContainers.get(key);
    if (!container) throw new Error("Container not found");
    try {
        const sh = "restart.sh"
        const exec = await serverControls(container, sh)

        exec.start({ hijack: true, stdin: false }, (err, stream) => {
            if (err) {
                console.error("Restart failed:", err);
                socket.emit("serverStatus", { running: false, liveServer: null });
                return;
            }

            console.log("Server restarted successfully");
            socket.emit("serverStatus", {
                running: true,
                liveServer: `${process.env.PROTOCOL}://${data.project}_${socket.user.username}.${process.env.SERVER_HOST_PREFIX}`,
            });
        });
    } catch (error) {
        console.error("Error restarting container:", error);
        socket.emit("serverStatus", { running: false, liveServer: `${process.env.PROTOCOL}://${data.project}_${socket.user.username}.${process.env.SERVER_HOST_PREFIX}` });
    }
};



export const handleStopServer = async (socket, userContainers, data) => {
    const key = `${socket.user.id}_${data.project}`;
    const container = userContainers.get(key);

    if (!container) throw new Error("Container not found");

    try {
        const sh = "stop.sh"
        const exec = await serverControls(container, sh)

        // Start the script
        exec.start({ hijack: true, stdin: false }, (err, stream) => {
            if (err) {
                console.error("Stop failed:", err);
                socket.emit("serverStatus", { running: true, liveServer: `${process.env.PROTOCOL}://${data.project}_${socket.user.username}.${process.env.SERVER_HOST_PREFIX}` }); // still running
                return;
            }
            socket.emit("serverStatus", { running: false, liveServer: null });
        });
    } catch (error) {
        console.error("Error stopping container:", error);
        socket.emit("serverStatus", { running: true, liveServer: `${process.env.PROTOCOL}://${data.project}_${socket.user.username}.${process.env.SERVER_HOST_PREFIX}` });
    }
};


export const handleRunCode = async (socket, userContainers, project, language, entryFile) => {
    const key = `${socket.user.id}_${project}`;
    const container = userContainers.get(key);

    if (!container) return socket.emit("runCodeResult", { success: false, error: "Container not found" });

    const result = await runCodeHandler(project, language, entryFile, container);
    socket.emit("runCodeResult", result);
};


export const handleDisconnect = async (socket, userContainers, userConnections, disconnectTimers) => {
    const project = socket.project;
    if (!project) return;

    const key = `${socket.user.id}_${project}`;
    const connections = userConnections.get(key);

    if (!connections) return;

    // Remove this socket from the set
    connections.delete(socket.id);

    // If there are still active connections, do nothing
    if (connections.size > 0) return;

    // No active connections → start cleanup timer
    console.log(`⌛ Starting cleanup timer for ${key}`);


    if (socket.framework) {
        await removeTraefikContainer(socket);
        socket.emit("serverStatus", { running: false, liveServer: null });
    }



    // Clear any existing timer just in case
    if (disconnectTimers.has(key)) {
        clearTimeout(disconnectTimers.get(key));
        disconnectTimers.delete(key);
    }

    const timer = setTimeout(async () => {
        // Check again if the user reconnected in the meantime
        const stillConnected = userConnections.get(key)?.size > 0;
        if (stillConnected) {
            console.log(`❌ User reconnected for ${key}, cancel container cleanup`);
            disconnectTimers.delete(key);
            return;
        }




        // Stop and remove container if exists
        const container = userContainers.get(key);
        if (container) {
            try {
                await container.stop();
                await container.remove();

                await Project.findOneAndUpdate(
                    { slug: project, owner: socket.user.id },
                    { status: "stopped", lastRunAt: new Date() }
                );

                console.log("🗑️ Container removed for:", key);
            } catch (err) {
                console.error("Error stopping container:", err.message);
            }
            userContainers.delete(key);
        }

        // Cleanup maps
        userConnections.delete(key);
        disconnectTimers.delete(key);

        // Remove Traefik container if framework exists
        if (socket.framework) {
            await removeTraefikContainer(socket);
            socket.emit("serverStatus", { running: false, liveServer: null });
        }
    }, 3000);

    // Store timer so it can be cleared if user reconnects
    disconnectTimers.set(key, timer);
};
