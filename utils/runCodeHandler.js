// handlers/runCodeHandler.js
export const runCodeHandler = async (project, language, entryFile, container) => {
  try {
    // console.log("project:", project);
    // console.log("language:", language);
    // console.log("Execute script:", entryFile);
    // console.log("Container:", container.id);

    // 👉 here you put your actual logic to run code inside container
    // e.g. run docker exec, npm start, etc.


    if (!container) {
      // throw new Error("No running container available");
      console.log("no container available")
    }



    const commandMap = {
      ".js": (file) => ["node", file],
      ".py": (file) => ["python3", file],
      ".ts": (file) => ["ts-node", file],
    };

    const ext = entryFile.slice(entryFile.lastIndexOf("."));
    const command = commandMap[ext] ? commandMap[ext](entryFile) : entryFile.split(" ");


    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: "/usr/src/app",
    });




    const stream = await exec.start({});

    let output = "";
    await new Promise((resolve, reject) => {
      container.modem.demuxStream(
        stream,
        {
          write: (chunk) => (output += chunk.toString()),
        },
        {
          write: (chunk) => (output += chunk.toString()),
        }
      );

      stream.on("end", resolve);
      stream.on("error", reject);
    });

    return { success: true, output };
  } catch (error) {
    console.error("Error while running code:", error);
    return { success: false, error: error.message };
  }
};
