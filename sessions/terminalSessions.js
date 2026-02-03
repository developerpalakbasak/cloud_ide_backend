// terminalSessions.js
import { terminalSessions } from "../states/state.js";
import isEchoOfInput from "../utils/helper_fns/isEachoOfInput.js";
import stripAnsi from "strip-ansi";

let lastInput = "";
let currentDir = "";

function createHandleTerminalOutput(socket, project) {
    let lastOutput = "";
    let lastTime = 0;

    return function handleTerminalOutput(chunk) {
        const output = chunk.toString("utf-8");
        const now = Date.now();
        if (/^\x1B\[[0-9;]*R$/.test(output)) return;
        const isEcho = isEchoOfInput(lastInput, output)
        if (isEcho) return
        if (isEcho && now - lastTime < 50) {
            lastTime = now;
            return
        }

        const cleaned = stripAnsi(output);
        const lines = cleaned.split("\n");

        for (const line of lines) {
            const trimmed = line.trim();

            // Detect prompt lines like "/usr/src/app #"
            const match = trimmed.match(/^([\/~A-Za-z0-9._-]+)\s*#$/);

            if (match) {
                currentDir = match[1];
            }
        }

        if (output.length > 0) {
            if (lastOutput.toString() !== output.toString()) {
                socket.emit("terminalOutput", { output });
                lastOutput = output
                lastInput = '';
                lastTime = now;
            }
            return
        }
        return
    };
}

function handleTerminalDisconnect(terminalSessions, socket, key) {
    socket.on("disconnect", () => {

        const session = terminalSessions.get(key);
        if (session) {
            try {
                session.stream.end();
            } catch (err) {
                console.error("Error ending stream:", err.message);
            }
            terminalSessions.delete(key);
        }

    });
}

function checkIsInsideAppDir(path) {
    const normalizedPath = path.replace(/\/+$/, ""); // remove trailing slash
    const basePath = "/usr/src/app";
    return normalizedPath === basePath || normalizedPath.startsWith(basePath + "/");
}



const protectedFiles = [
  "index.js",
  "package.json",
  "restart.sh",
  "start.sh",
  "stop.sh"
];

function isDeletingProtectedFile(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("rm")) return false;
  const parts = trimmed.split(/\s+/).slice(1);
  return parts.some(part => protectedFiles.includes(part));
}




function handleTerminalInput(socket, stream) {
    if (socket.hasInputHandler) return; // ✅ prevent duplicates
    socket.hasInputHandler = true;

    let lastInputTime = 0;

    socket.on("terminalInput", ({ input }) => {
        if (!input) return;

        const isInsideAppDir = checkIsInsideAppDir(currentDir);
        const isRestrictedCmd = isDeletingProtectedFile(input);

        console.log(isRestrictedCmd)

        const cmd = `${input}\n`;
        const now = Date.now();

        if (cmd === lastInput && now - lastInputTime < 100) return;

        const trimmed = input.trim();
        const isAllowedOutside =
            trimmed === "ls" || trimmed.startsWith("ls ") ||
            trimmed === "cd" || trimmed.startsWith("cd ");

        if (isRestrictedCmd) {
            socket.emit("terminalOutput", {
                output: "!Failed, You can delete only your creations.\r\n"
            });
            socket.emit("terminalOutput", {
                output: `${currentDir} # `
            });
            return;
        }
        if (!isInsideAppDir && !isAllowedOutside) {
            socket.emit("terminalOutput", {
                output: "!Failed, You can only run commands inside /usr/src/app.\r\n"
            });
            socket.emit("terminalOutput", {
                output: `${currentDir} # `
            });
            return;
        }



        lastInput = cmd;
        lastInputTime = now;

        stream.write(cmd);
    });
}

function handleTerminalResize(socket, terminalSessions, key) {
    let lastResize = { cols: null, rows: null };
    let lastResizeTime = 0;
    let resizeTimeout;

    socket.on("terminalResize", async ({ cols, rows }) => {
        // Ignore invalid resize events
        if (!cols || !rows) return;

        const now = Date.now();
        const session = terminalSessions.get(key);
        if (!session || !session.exec) return;

        // 🧠 Prevent duplicate or too-frequent resize calls
        if (
            lastResize.cols === cols &&
            lastResize.rows === rows &&
            now - lastResizeTime < 200
        ) {
            return;
        }

        lastResize = { cols, rows };
        lastResizeTime = now;

        // Debounce the resize a bit (avoids rapid spam while dragging)
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(async () => {
            try {
                await session.exec.resize({ h: rows, w: cols });

                session.ignoreOutput = true;
                setTimeout(() => {
                    session.ignoreOutput = false;
                }, 500);
            } catch (err) {
                console.error("Terminal resize failed:", err.message);
            }
        }, 100);
    });
}


export const startTerminalSession = async (container, socket, key, project) => {

    // Reuse session if already exists
    if (terminalSessions.has(key)) {
        const session = terminalSessions.get(key);

        return session;
    }

    const exec = await container.exec({
        Cmd: ["/bin/sh"],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    handleTerminalInput(socket, stream);

    handleTerminalResize(socket, terminalSessions, key)

    const handleTerminalOutput = createHandleTerminalOutput(socket, project);
    container.modem.demuxStream(
        stream,
        {
            write: (chunk) => handleTerminalOutput(chunk),
        },
        null
    );

    handleTerminalDisconnect(terminalSessions, socket, key)

    // Store session for reuse
    const session = { exec, stream, container };
    terminalSessions.set(key, session);

    return session;
};
