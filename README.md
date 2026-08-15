# Nook — visual home inventory

Nook is a private, mobile-first home inventory for remembering exactly where things live. It includes a household login, an interactive isometric floor plan, camera photo and walkthrough-video capture, OpenAI-assisted room and storage recognition, panoramic room views, reviewable inventory suggestions, search, voice-assisted entry, offline IndexedDB storage, JSON backup/restore, and optional Neon Postgres sync.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. Camera capture works on a phone when the site is served over HTTPS or on localhost.

Copy `.env.example` to `.env.local`, set the household login values, `AUTH_SECRET`, and `OPENAI_API_KEY`, and keep `LOCAL_DATABASE_PATH=nook.db` to use the built-in SQLite database at `.data/nook.db` for local testing. The `.data` directory and local credentials are ignored by Git.

## Deploy free on Vercel Hobby

1. Push this project to a Git repository and import it at [vercel.com/new](https://vercel.com/new).
2. In the Vercel project, open **Storage → Create Database → Neon** and choose Neon's Free plan. Vercel injects `DATABASE_URL` automatically.
3. In **Settings → Environment Variables**, add `NOOK_USERNAME` and `NOOK_PASSWORD` with private household credentials. Add `AUTH_SECRET` using a long random value from `openssl rand -base64 32`. Add your server-side `OPENAI_API_KEY` and set `OPENAI_VISION_MODEL=gpt-5.6-luna`.
4. Redeploy the project.
5. Open Nook and sign in with the same household credentials on each trusted phone or laptop.

The API creates the `nook_homes` table on first use. The equivalent schema is also saved in [`db/neon-schema.sql`](db/neon-schema.sql).

## Data model and privacy

- The authoritative synced inventory is one JSON document in Neon Postgres.
- New rooms, storage spaces, and inventory items are written immediately to the local copy and queued in order for Neon sync.
- Local development uses a SQLite database file when `LOCAL_DATABASE_PATH` is set and `DATABASE_URL` is absent.
- A local IndexedDB copy keeps the app usable offline and before Neon is connected.
- Room photos and panoramas are resized and compressed before storage.
- Photos are compressed and walkthrough videos are sampled into still frames in the browser before OpenAI vision analysis.
- OpenAI suggestions are not saved until the signed-in user reviews and approves rooms, storage spaces, and visible items.
- Floor-plan geometry is an approximate visual proposal and is not a substitute for architectural measurements.
- `OPENAI_API_KEY` is read only by the protected server route and is never included in browser code.
- Every app page and API route is protected by a signed, HTTP-only session cookie. Credentials and the signing secret remain server-side in Vercel.
- Failed logins do not reveal which credential was incorrect, and comparisons are performed in constant time.
- For a multi-user public product, replace the shared household login with per-user accounts and per-user database rows.
- Export a JSON backup regularly from **Sync & backup**.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm test
```
