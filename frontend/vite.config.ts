import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Needed for LAN; a "public" URL still comes from a tunnel (ngrok, cloudflared, localtunnel), not from Vite alone.
    host: true,
    strictPort: true,
    // Accept Host headers from tunnel domains (localtunnel, ngrok, Cloudflare, etc.).
    allowedHosts: true,
  },
  preview: {
    host: true,
    strictPort: true,
    allowedHosts: true,
  },
});
