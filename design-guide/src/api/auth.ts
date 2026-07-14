import type { LoginResponse } from "@/types/auth";
import { postJson } from "./client";

export async function loginRequest(body: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return postJson<LoginResponse>("/auth/login", body, { sendUserId: false });
}
