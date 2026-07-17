import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { buildSocketAuthPayload, getSocketUrl } from "@/api/socket";
import type { GenerationLifecycleEvent } from "@/types/generate";

type Props = {
  requestId: string | null;
  onEvent: (event: GenerationLifecycleEvent) => void;
  onSocketError: (message: string) => void;
};

export function useGenerationSocket({ requestId, onEvent, onSocketError }: Props) {
  const onEventRef = useRef(onEvent);
  const onSocketErrorRef = useRef(onSocketError);

  onEventRef.current = onEvent;
  onSocketErrorRef.current = onSocketError;

  useEffect(() => {
    if (!requestId) return;

    const socket = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      auth: buildSocketAuthPayload(),
    });

    socket.on("connect", () => {
      socket.emit(
        "join_generation",
        { requestId },
        (ack: { ok?: boolean; message?: string } | undefined) => {
          if (!ack?.ok) {
            onSocketErrorRef.current(
              ack?.message ?? "Could not subscribe to generation updates.",
            );
          }
        },
      );
    });

    socket.on("connect_error", (error) => {
      onSocketErrorRef.current(error.message || "Realtime connection failed.");
    });

    socket.on("generation_lifecycle", (payload: GenerationLifecycleEvent) => {
      if (!payload || payload.requestId !== requestId) return;
      onEventRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [requestId]);
}
