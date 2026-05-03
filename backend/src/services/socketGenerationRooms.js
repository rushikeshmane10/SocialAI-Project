/**
 * @param {import("socket.io").Server} io
 */
export function setupSocketGenerationRoomHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("join_generation", (payload, ack) => {
      const requestId = payload && typeof payload.requestId === "string" ? payload.requestId.trim() : "";
      if (!requestId) {
        if (typeof ack === "function") ack({ ok: false, code: "VALIDATION_ERROR", message: "requestId is required" });
        return;
      }
      socket.join(`generation:${requestId}`);
      if (typeof ack === "function") ack({ ok: true, requestId });
    });
  });
}
