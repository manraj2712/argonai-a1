# Photo Intake

Upload photos, have each one checked for format, size, blur, faces and near-duplicates, and watch them land in **Accepted** or **Rejected** with a reason.

- Domain language: [`CONTEXT.md`](CONTEXT.md)
- Design, schema, API contract and pipeline: [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md)
- Decisions and their trade-offs: [`docs/adr/`](docs/adr)

## Stack

React 19 + Vite + Tailwind · Express 5 · PostgreSQL 17 via Prisma 7 · S3-compatible storage (SeaweedFS locally) · sharp, heic-decode and face-api (WASM) for image work · pnpm workspaces, TypeScript everywhere.

## Run everything in Docker

```sh
docker compose --profile app up --build
```

Open http://localhost:8080. Migrations run automatically.

## Develop locally

Needs Node 22.12+ (`nvm use`) and pnpm 10.

```sh
cp .env.example .env
docker compose up -d postgres storage
pnpm install
pnpm db:migrate
pnpm dev                                    # web on :5173 and the API on :3000
pnpm --filter @image-intake/api dev:worker  # in a second terminal
```

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test        # integration tests need the compose Postgres running
pnpm --filter @image-intake/api calibrate   # what each check measures on the fixtures
```

## How an image moves through the system

1. The browser sniffs the file's magic bytes and size. Anything that isn't JPEG, PNG or HEIC is rejected on the spot.
2. `POST /api/images` creates the rows and returns a presigned POST per file. The browser uploads straight to storage, and the policy enforces size and content type.
3. `POST /api/images/:id/complete` marks the image pending in the same transaction that notifies the workers.
4. A worker claims it with `FOR UPDATE SKIP LOCKED`, normalizes it (HEIC → JPEG, EXIF orientation applied, metadata stripped), runs the checks, and records the verdict in one transaction.
5. Every status change reaches the browser over Server-Sent Events.
