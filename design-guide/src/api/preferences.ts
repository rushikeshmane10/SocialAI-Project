import type { PreferencesLogResponse, PreferencesMeResponse } from "@/types/preferences";
import { getJson, postJson } from "./client";

export async function fetchPreferencesMe(): Promise<PreferencesMeResponse> {
  return getJson<PreferencesMeResponse>("/preferences/me");
}

export async function logPreferences(
  answers: Record<string, string>,
): Promise<PreferencesLogResponse> {
  return postJson<PreferencesLogResponse>("/preferences/log", { answers });
}
