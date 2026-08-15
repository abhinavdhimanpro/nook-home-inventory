# Nook — visual home inventory

Nook is a private, mobile-first home inventory for remembering exactly where things live. It includes a household login, an interactive isometric floor plan, camera capture, room-by-room item records, search, voice-assisted entry, offline IndexedDB storage, JSON backup/restore, and optional Neon Postgres sync.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. Camera capture works on a phone when the site is served over HTTPS or on localhost.

## Deploy free on Vercel Hobby

1. Push this project to a Git repository and import it at [vercel.com/new](https://vercel.com/new).
2. In the Vercel project, open **Storage → Create Database → Neon** and choose Neon's Free plan. Vercel injects `DATABASE_URL` automatically.
3. In **Settings → Environment Variables**, add `NOOK_USERNAME` and `NOOK_PASSWORD` with private household credentials. Add `AUTH_SECRET` using a long random value from `openssl rand -base64 32`.
4. Redeploy the project.
5. Open Nook and sign in with the same household credentials on each trusted phone or laptop.

The API creates the `nook_homes` table on first use. The equivalent schema is also saved in [`db/neon-schema.sql`](db/neon-schema.sql).

## Data model and privacy

- The authoritative synced inventory is one JSON document in Neon Postgres.
- A local IndexedDB copy keeps the app usable offline and before Neon is connected.
- Room photos are resized to a maximum of 1200 px and compressed before storage.
- Every app page and API route is protected by a signed, HTTP-only session cookie. Credentials and the signing secret remain server-side in Vercel.
- Failed logins do not reveal which credential was incorrect, and comparisons are performed in constant time.
- For a multi-user public product, replace the shared household login with per-user accounts and per-user database rows.
- Export a JSON backup regularly from **Sync & backup**.

## Commands

```bash
npm run dev     # local development
npm run build   # production verification
npm run lint    # code-quality checks
npm test        # production build
```
