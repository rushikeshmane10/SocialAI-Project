import type {
  ConnectionCallbackResponse,
  ConnectionStatusResponse,
  InitiateConnectionResponse,
} from "@/types/connections";
import { getJson, postJson } from "./client";

export type ConnectionPlatform = "twitter" | "linkedin";

export async function fetchConnectionStatus(): Promise<ConnectionStatusResponse> {
  return getJson<ConnectionStatusResponse>("/connections/status");
}

export async function initiateConnection(
  platform: ConnectionPlatform,
): Promise<InitiateConnectionResponse> {
  return postJson<InitiateConnectionResponse>(`/connections/${platform}/initiate`, {});
}

export async function completeConnection(
  platform: ConnectionPlatform,
): Promise<ConnectionCallbackResponse> {
  return getJson<ConnectionCallbackResponse>(`/connections/${platform}/callback`);
}
