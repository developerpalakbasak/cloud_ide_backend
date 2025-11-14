export const liveTerminal = async (input, container, cwd) => {
  // console.log(input)
  // console.log(cwd)
  try {
    const exec = await container.exec({
      Cmd: ["sh", "-c", input],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      WorkingDir: cwd,
    });


    const stream = await exec.start({ hijack: true, stdin: false });

    let result = "";
    await new Promise((resolve, reject) => {
      container.modem.demuxStream(
        stream,
        {
          write: (chunk) => (result += chunk.toString()),
        },
        {
          write: (chunk) => (result += chunk.toString()),
        }
      );

      stream.on("end", resolve);
      stream.on("error", reject);
    });

    return { success: true, result };

  } catch {
    console.log("something went wrong");
    return { success: false, output: "something went wrong" };
  }
};
