import { useEffect } from "react";
import { io } from "socket.io-client";
import { buildSocketAuthPayload, getSocketUrl } from "../api/socket";
import type { GenerationLifecycleEvent } from "../types/generate";

type Props = {
  requestId: string | null;
  onEvent: (event: GenerationLifecycleEvent) => void;
  onSocketError: (message: string) => void;
};

export function useGenerationSocket({ requestId, onEvent, onSocketError }: Props) {
  useEffect(() => {
    if (!requestId) return;

    const socket = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      auth: buildSocketAuthPayload(),
    });

    socket.on("connect", () => {
      socket.emit("join_generation", { requestId }, (ack: { ok?: boolean; message?: string } | undefined) => {
        if (!ack?.ok) {
          onSocketError(ack?.message ?? "Could not subscribe to generation updates.");
        }
      });
    });

    socket.on("connect_error", (error) => {
      onSocketError(error.message || "Realtime connection failed.");
    });

    socket.on("generation_lifecycle", (payload: GenerationLifecycleEvent) => {
      if (!payload || payload.requestId !== requestId) return;
      onEvent(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [requestId, onEvent, onSocketError]);
}
