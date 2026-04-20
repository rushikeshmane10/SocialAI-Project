# Supabase Postgres configuration

This backend talks to **Supabase only as managed Postgres**. It does not use the Supabase JS client, Auth UI, or Realtime. Everything goes through **`DATABASE_URL`** and **Sequelize** + the **`pg`** driver.

---

## 1. What you configure

| Item | Where |
|------|--------|
| Connection URI | **`backend/.env`** → **`DATABASE_URL`** |
| Schema | SQL files under **`backend/migrations/`**; apply with **`npm run db:migrate`** (or migrations on startup in development — see [`.env.example`](.env.example) `RUN_MIGRATIONS_ON_START`) |

Copy values from the Supabase dashboard; never commit real secrets (`.env` is gitignored).

---

## 2. Getting the URI from Supabase

1. Open your project in [Supabase](https://supabase.com/dashboard).
2. Go to **Project Settings** (gear) → **Database**.
3. Under **Connection string**, choose **URI**.
4. Pick the mode that matches your network (see below):
   - **Direct connection** — host looks like **`db.<project-ref>.supabase.co`**, port **5432**, user **`postgres`**.
   - **Session pooler** or **Transaction pooler** — host looks like **`aws-0-<region>.pooler.supabase.com`**, user often **`postgres.<project-ref>`** for the pooler; port **5432** (session) or **6543** (transaction) depending on what Supabase shows for your selection.

Paste the full URI into **`DATABASE_URL`** as a single line.

---

## 3. URI shape (examples — placeholders only)

**Direct (IPv6-capable networks):**

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

**Transaction pooler (common for IPv4-only or serverless-style access):**

```env
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:6543/postgres
```

The **`YOUR_REGION`** segment must match the region shown next to that connection string in the dashboard (for example `ap-south-1`, `us-east-1`). A wrong region often produces errors such as **“Tenant or user not found”** from the pooler.

**Invalid host (will not work):**

```text
db.supabase.co   # missing project ref — DNS will not resolve your database
```

### Password and special characters

The URI is parsed as a URL. If the database password contains **`@`**, **`:`**, **`#`**, **`/`**, or other reserved characters, **percent-encode** them in the password segment (for example **`@`** → **`%40`**). Otherwise the parser will split user, password, and host incorrectly.

---

## 4. How the backend opens the connection

Implementation: **[`src/db/sequelize.js`](src/db/sequelize.js)**.

1. **Load `DATABASE_URL`** from the environment via **[`src/config/env.js`](src/config/env.js)** (Zod-validated; optional in development, required in production).

2. **Supabase direct host and IPv6 (Windows-friendly DNS)**  
   If the hostname matches **`db.<ref>.supabase.co`**:
   - The module tries **`dns.resolve4`**. If there is at least one IPv4 address, the original URL is used unchanged.
   - If there is **no** IPv4 record (Supabase direct is often **IPv6-only**), it uses **`dns.resolve6`**, rewrites the URL host to the first IPv6 literal **`[<addr>]`**, and remembers the **original hostname** for TLS.

3. **Sequelize** is constructed with that resolved URL (or the original URL for pooler / non-matching hosts).

4. **TLS for Supabase**  
   If the URL host contains **`supabase.co`** or **`pooler.supabase.com`**, Sequelize is given **`dialectOptions.ssl`**: **`require: true`**, **`rejectUnauthorized: false`** (typical for managed Postgres where you do not install a custom CA in the app).

5. **TLS Server Name Indication (SNI)**  
   When connecting to a **numeric IPv6 literal** for a Supabase **direct** host, the TLS layer still sets **`servername`** to **`db.<ref>.supabase.co`** so the certificate name matches what the server presents.

6. **First real connection**  
   When the app registers routes, it calls **`sequelize.authenticate()`** (see **[`src/routes/index.js`](src/routes/index.js)**). If that fails, the server still starts but logs a warning; DB-backed routes may return **503** until Postgres is reachable.

7. **Migrations**  
   If enabled, **`runMigrations`** runs after a successful authenticate. CLI: **`npm run db:migrate`**.

---

## 5. Troubleshooting

| Symptom | Likely cause | What to try |
|--------|----------------|-------------|
| **`getaddrinfo ENOTFOUND`** for `db.*.supabase.co` | Node on Windows using a DNS path that does not surface **AAAA-only** names the same way as `nslookup`. | Restart the server with the current `sequelize.js` (AAAA rewrite). If it still fails, switch to the **pooler** URI from the dashboard. |
| **`ENETUNREACH`** to an IPv6 address | Your machine or network has **no route** to IPv6. | Use the **pooler** connection string (usually **IPv4**). |
| **`Tenant or user not found`** (pooler) | Wrong **region** in the pooler hostname, or wrong **user** format for that pool mode. | Copy the URI again from **Database → Connection string**; do not guess `aws-0-*`. |
| **`password authentication failed`** | Wrong password or wrong encoding in the URI. | Reset the DB password in Supabase; re-paste the URI; encode special characters. |
| **`self-signed certificate in certificate chain`** | Strict TLS verification without Supabase’s chain in trust store. | This repo already relaxes verification for Supabase hosts in `sequelize.js`. If you customized SSL, align with that. |
| Timeouts / refused | Project **paused** (free tier), firewall, or VPN blocking outbound **5432/6543**. | Resume project in Supabase; check corporate firewall. |

---

## 6. Related files

| File | Role |
|------|------|
| [`src/db/sequelize.js`](src/db/sequelize.js) | Resolve direct Supabase URL for IPv6, SSL, Sequelize instance, models |
| [`src/db/migrate-cli.js`](src/db/migrate-cli.js) | `npm run db:migrate` entry |
| [`src/db/migrate.js`](src/db/migrate.js) | Ordered SQL migrations |
| [`src/routes/index.js`](src/routes/index.js) | Startup `authenticate`, optional migrations, connectivity warnings |
| [`.env.example`](.env.example) | Template and short comments for `DATABASE_URL` |

---

## 7. Apply schema after Postgres is reachable

From the **`backend`** directory:

```bash
npm run db:migrate
```

Ensure seed / user rows match your auth expectations (see the main **[`README.md`](README.md)** database section for seed user notes).
