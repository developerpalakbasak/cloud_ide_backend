// terminalSessions.js
import { terminalSessions } from "../states/state.js";
import isEchoOfInput from "../utils/helper_fns/isEachoOfInput.js";
import stripAnsi from "strip-ansi";

let lastInput = "";

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

        ////////////////////////

        // const terminalOutput = stripAnsi(output.toString());

        // let parsedOutput;
        // try {
        //     parsedOutput = eval(`(${terminalOutput})`); // dangerous but works if you trust the output
        // } catch {
        //     parsedOutput = { success: false, message: terminalOutput };
        // }

        // const { success, message } = parsedOutput;


        // if (success && message == "Example app listening on port 8000") {
        //     socket.emit("serverStatus", { running: true, liveServer: `http://${project}_${socket.user.username}.${process.env.SERVER_HOST_PREFIX}` });
        // }


        /////////////////////////
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

function isRestrictedCmd(command) {
    if (!command) return false;

    // Protection levels
    const fileProtection = {
        "app.log": "noAccess",
        "nodemon.pid": "noAccess",
        "restart.sh": "noAccess",
        "index.js": "noDelete",
        "package-lock.json": "noDelete",
        "start.sh": "noAccess",
        "package.json": "noDelete",
        "stop.sh": "noAccess"
    };

    // Commands that delete or move/copy files
    const dangerousCmds = ["rm", "del", "mv", "cp"];

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    for (let i = 1; i < parts.length; i++) {
        const arg = parts[i].toLowerCase();

        if (!fileProtection[arg]) continue;

        const protection = fileProtection[arg];

        if (protection === "noAccess") {
            // block any command
            return true;
        }

        if (protection === "noDelete" && dangerousCmds.includes(cmd)) {
            // block only deletion/move/copy
            return true;
        }
    }

    return false; // allowed
}




function handleTerminalInput(socket, stream) {
    if (socket.hasInputHandler) return; // ✅ prevent duplicates
    socket.hasInputHandler = true;

    let lastInputTime = 0;

    socket.on("terminalInput", ({ input }) => {
        if (!input) return;
        // const isDengerousCmd = isRestrictedCmd(input)

        // if (isDengerousCmd) {
        //     socket.emit("isDengerousCmd", { success: false, message: "permission denied" });
        //     return
        // }
        const cmd = `${input}\n`;
        const now = Date.now();

        // Prevent duplicate input within 100ms
        if (cmd === lastInput && now - lastInputTime < 100) return;

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
