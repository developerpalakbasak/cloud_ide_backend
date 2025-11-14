import isAuthSocket from "../middleware/socket.auth.js";
import { handleDisconnect, handleRestartServer, handleRunCode, handleSaveProject, handleStartContainer, handleStartServer, handleStartTerminal, handleStopServer } from "./socketHandlers.js";
import {
  userContainers,
  userConnections,
  disconnectTimers,
} from "../states/state.js";
import catchSocket from "../utils/catchAsyncSocket.js";

export function socketHandler(io) {
  io.use(isAuthSocket);

  io.on("connection", (socket) => {

    console.log("socket connect")
    socket.on(
      "startContainer",
      catchSocket((data) => {
        handleStartContainer(
          socket, userContainers, userConnections, disconnectTimers, data.language, data?.framework, data.project
        )
      }
      )
    );

    socket.on("stopServer", catchSocket((data) => {
      handleStopServer(socket, userContainers, data)
    }));
    
    socket.on("restartServer", catchSocket((data) => {

      handleRestartServer(socket, userContainers, data)
    }));

    socket.on("startServer", catchSocket((data) => {
      handleStartServer(socket, userContainers, data)
    }));

    // all terminal controls input, outputs inside this fn
    socket.on("terminalOpen", catchSocket(async (data) => {
      let { project } = data;
      await handleStartTerminal(socket, userContainers, project)
    }));



    socket.on("saveProject", (data) => {
      handleSaveProject(socket, data.project, data.files)
    }
    );

    socket.on("runCode", (data) =>
      handleRunCode(socket, userContainers, data.project, data.language, data.entryFile)
    );

    socket.on("disconnect", () => {
      handleDisconnect(socket, userContainers, userConnections, disconnectTimers)
    });


  });
}
