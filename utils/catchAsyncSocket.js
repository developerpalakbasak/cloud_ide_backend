const catchSocket = (fn) => async (socket, ...args) => {
  try {
    await fn(socket, ...args);
  } catch (err) {
    console.error("Socket error:", err);
    socket.emit("errorOccurred", {
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

export default catchSocket;
