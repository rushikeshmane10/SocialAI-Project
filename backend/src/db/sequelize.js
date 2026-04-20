  import dns from "node:dns/promises";
import { Sequelize } from "sequelize";
import { env } from "../config/env.js";
import { initModels } from "../models/index.js";

/**
 * Direct Supabase host `db.<ref>.supabase.co` often has only AAAA (IPv6). Node's default
 * `getaddrinfo` path on Windows can return ENOTFOUND when no A record exists. Resolve AAAA
 * explicitly and connect to the literal address; keep TLS SNI on the original hostname.
 * @param {string} urlString
 */
async function resolveSupabaseDirectConnectionUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return { url: urlString, tlsServerName: undefined };
  }

  const host = u.hostname;
  if (!/^db\.[^.]+\.supabase\.co$/i.test(host)) {
    return { url: urlString, tlsServerName: undefined };
  }

  try {
    const ipv4 = await dns.resolve4(host);
    if (ipv4.length > 0) {
      return { url: urlString, tlsServerName: undefined };
    }
  } catch {
    // try AAAA
  }

  let ipv6List;
  try {
    ipv6List = await dns.resolve6(host);
  } catch {
    return { url: urlString, tlsServerName: undefined };
  }

  if (!ipv6List.length) {
    return { url: urlString, tlsServerName: undefined };
  }

  u.hostname = `[${ipv6List[0]}]`;
  return { url: u.toString(), tlsServerName: host };
}

const { url: resolvedDatabaseUrl, tlsServerName: supabaseDirectTlsServerName } =
  env.DATABASE_URL != null && env.DATABASE_URL !== ""
    ? await resolveSupabaseDirectConnectionUrl(env.DATABASE_URL)
    : { url: undefined, tlsServerName: undefined };

let sequelize = null;
/** @type {ReturnType<typeof initModels> | null} */
let models = null;

export function getSequelize() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!sequelize) {
    const url = resolvedDatabaseUrl ?? env.DATABASE_URL;
    const isSupabaseHost =
      url.includes("supabase.co") || url.includes("pooler.supabase.com");
    sequelize = new Sequelize(url, {
      dialect: "postgres",
      logging: false,
      define: { underscored: true },
      dialectOptions: isSupabaseHost
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
              ...(supabaseDirectTlsServerName
                ? { servername: supabaseDirectTlsServerName }
                : {}),
            },
          }
        : {},
    });
    models = initModels(sequelize);
  }
  return sequelize;
}

export function getModels() {
  getSequelize();
  return models;
}

export async function closeSequelize() {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    models = null;
  }
}
