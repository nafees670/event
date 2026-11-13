# Video Lamhe — working notes for Claude

Drone wedding videography marketplace for Pakistan. Full spec: the master prompt (phases 0–9).
**Current phase: 3 (media & shorts) — done** (live Cloudinary upload test pending keys). Work phase by phase; stop for review after each.

## Run it

```bash
cp .env.example .env        # fill JWT_* secrets (≥32 chars) and SEED_ADMIN_* — see comments in the file
npm install
npm run db:up               # Mongo 7 + Redis 7 via docker compose (local dev only)
npm run seed                # admin + 12 cities + 4 drones + 6 SAMPLE operators + 12 SAMPLE shorts (idempotent)
npm run dev                 # api :4000 + web :3000 together
```

- API health: http://localhost:4000/api/v1/health · readiness: `/api/v1/ready` (503 if Mongo is down)
- Design system showcase: http://localhost:3000/ui (check both themes)
- Admin: http://localhost:3000/admin (log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- Sample operators: `sample-operator-1…6@videolamhe.test` / `SEED_OPERATOR_PASSWORD`

## Commands (repo root)

| Command                                   | What                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                             | web + api in watch mode (concurrently)                                |
| `npm run lint`                            | ESLint (flat config, `--max-warnings 0`)                              |
| `npm run typecheck`                       | `tsc --noEmit` in every workspace                                     |
| `npm test`                                | Vitest in every workspace (API tests need Mongo: `npm run db:up`)     |
| `npm run check`                           | lint + typecheck + test                                               |
| `npm run build`                           | api → `apps/api/dist` (tsup), web → `.next`                           |
| `npm run format` / `format:check`         | Prettier (+ tailwind class sorting)                                   |
| `npm run db:up` / `db:down`               | local Mongo/Redis containers                                          |
| `npm run seed` / `npm run seed -- --prod` | seed data; `--prod` = admin + cities + drones only (no sample data)   |
| `npm run db:indexes -w @video-lamhe/api`  | create missing Mongo indexes (`-- --sync` also drops undeclared ones) |

Single workspace: `npm run <script> -w @video-lamhe/api` (or `web`, `shared`).

## Folder map

```
apps/api/src
  index.ts            boot: env → Mongo → ensureIndexes → HTTP server → graceful shutdown
  app.ts              createApp({ env, logger, checkReadiness, mailer, media, lockout? }) — middleware + routers
  config/             env.ts (Zod, refuses to boot), rateLimits.ts (ALL limits + lockout), constants.ts
  lib/                logger, db (configureMongoose / connect / ensureIndexes), errors, asyncHandler, tokens,
                      password, mailer (SMTP or dev log), lockout (in-memory; Redis in Phase 8), slug,
                      media (Cloudinary behind MediaService: sign / getAsset / destroy + delivery URLs)
  middleware/         auth (requireAuth/optionalAuth/requireRole), validate (Zod), rateLimit, errorHandler, timeout
  models/             User, RefreshSession, Setting, City, DroneModel, Operator, OperatorDrone, Short,
                      ShortLike + SavedShort (ShortEngagement.ts) (+ index.ts registry)
  services/           catalog (queries + serializers — the ONLY place public operator JSON is built),
                      operators (create/update/status/delete), shorts (feed, upload verification, engagement),
                      auth, sessions, invite, contactSettings
  routes/             health, auth (+ /register/operator), catalog (public /cities /drones /operators),
                      contact, settings, shorts (public feed + like/save/view), uploads (signature),
                      operatorSelf (/operator/* incl. shorts), admin/ (cities, drones, operators, shorts)
  seed/ + scripts/    seed data + runner (npm run seed), db-indexes
  types/express.d.ts  req.auth
apps/api/test         Vitest + Supertest on a real Mongo; db.ts uses the same configureMongoose() as production
apps/web
  app/(site)/         public: home, shorts, drones/(list), drones/[slug], operators/(list), operators/[slug], cities/[slug]
  app/(auth)/         login (login + register on one screen), register/operator, forgot-password, reset-password
  app/(dashboard)/    account (+ saved shorts), operator (dashboard + my shorts), admin/* (overview, shorts, cities, drones, operators)
  app/ui/             design-system showcase
  components/ui/      Button, Input, Select, Textarea, Switch, Card, Chip, Tabs, Badge, Modal, Skeleton, FormAlert, ThemeToggle
  components/catalog/ OperatorCard, OperatorActions, OperatorAvatar, DroneModelCard, FilterBar, Pagination, EmptyState…
  components/admin/   AdminShell, CitiesAdmin, DronesAdmin, OperatorsAdmin, OperatorAdminForm, DronePricing, ConfirmDialog…
  components/operator/ OperatorProfileFields (shared by every operator form), DronesManager, OperatorDashboard, register form
  components/auth/    AuthBootstrap, RequireAuth, LoginScreen + forms
  components/shorts/  ShortsFeed, ShortPlayer, ShortActions, ShortsFilters, ShortThumb(+Grid), VideoPreview, SavedShorts…
  components/media/   VideoUploader, ImageUploader, ImageGallery, useUpload, ProgressBar
  components/contact/ ContactGate, PendingActionRunner, WhatsappPickerHost, CallSheetHost, WhatsappButton, FloatingWhatsapp
  components/layout/  SiteHeader, SiteNav, DashboardHeader, SyncedThemeToggle, Logo
  lib/api/            client (browser), server (serverApi / serverApiSafe for ISR), catalog-client, shorts-client, auth
  lib/                catalog-options (URL allow-lists), format, events, forms, contact/*, media/upload, shorts/engagement
  stores/             auth (access token in memory only), whatsapp-picker, call-sheet, short-engagement
packages/shared/src   constants, whatsapp, types, catalog-types, shorts-types, schemas/ (common incl. patchSchema, auth,
                      contact, catalog, shorts)
```

## Auth & contact gate — how it works

- **Access token** (15 min JWT) lives in memory only (`useAuthStore`). **Refresh token** is an httpOnly
  `vl_rt` cookie (SameSite=Strict, path `/api/v1/auth`, 7 days), rotated on every refresh and tracked in
  `RefreshSession`. Replaying a used token bumps `User.refreshTokenVersion`, which revokes every session.
  On page load `AuthBootstrap` calls `/auth/refresh` to restore the session.
- **Web and API must be same-site** in production (e.g. `videolamhe.pk` + `api.videolamhe.pk`) or the
  SameSite=Strict cookie won't be sent.
- **Contact actions:** wrap the button in `<ContactGate action="whatsapp" context={{ operatorSlug, operatorName, … }}>`
  (or use `WhatsappButton` / `OperatorActions`). A guest's click saves a pending action and goes to
  `/login?returnTo&action&target`. After login, `PendingActionRunner` runs it on `returnTo`. Each phase adds its
  action to `lib/contact/execute.ts` (now: whatsapp, call, like, save).
- **WhatsApp:** picker → `POST /contact/whatsapp` (auth) → `waLink`. **Call:** `GET /operators/:slug/contact` (auth).
  While `WHATSAPP_ROUTING=admin`, both return the admin number. The WhatsApp tab is opened synchronously on click
  to avoid popup blockers.
- New contact endpoints **must** use `requireAuth` plus a limiter from `config/rateLimits.ts`.
- **Indexes:** `autoIndex` is off. `ensureIndexes()` runs at boot and creates every declared index (non-destructive).
  New models must be exported from `models/index.ts` or their indexes won't be created.
- **TRUST_PROXY** = number of proxies in front of the API (0 local, usually 1 on Render). It is required in production.

## Catalogue rules (Phase 2)

- **Public operator JSON is built only by the `services/catalog.ts` serializers.** The phone is never loaded
  (`select('-phone')`) and never mapped. API tests scan public responses for `92xxxxxxxxxx`.
- **PATCH schemas use `patchSchema(shape)`**, never `.partial()`, because Zod 4 keeps defaults in `.partial()`.
- An optional text or price field sent empty (key present, value undefined/null) means **clear it** → `null`.
- `Operator.priceFrom` / `priceSort` are denormalised. Call `recomputePriceFrom()` after any OperatorDrone change.
- Media URLs must be `https://res.cloudinary.com/...` (shared `cloudinaryUrlSchema`; next/image allow-list).
- Server pages: `serverApi()` calls `notFound()` on 404. **In `generateMetadata` pass `{ allowMissing: true }`**
  (returns `null`) so the page, not the streamed metadata, triggers the 404. Otherwise the status code stays 200.
- Don't put a `loading.tsx` above a `[slug]` page. List skeletons live in `(list)/loading.tsx`.
- Web list filters live in the URL. Allow-list values with `lib/catalog-options.ts` before calling the API.
- Mongoose global settings go in `configureMongoose()` only (shared with tests). No `sanitizeFilter`: it breaks `$in`.

## Media & shorts rules (Phase 3)

- **Uploads never pass through the API.** Browser: `GET /uploads/signature?type=` → POST the file straight to
  Cloudinary → send `public_id` to the API. The signature pins the folder `video-lamhe/<kind>/<userId>`.
- **Never trust an upload**: `createShortFromUpload()` checks the folder belongs to the uploader and asks Cloudinary
  (`media.getAsset`) for size/duration. Too long/large → destroyed + 400.
- Images (operator photo, drone images) must be `isOurAssetUrl(url, cloudName)`. Replaced/removed images are destroyed
  (`destroyLater`, fire-and-forget until BullMQ in Phase 8).
- All Cloudinary access goes through `MediaService` (tests use `fakeMedia()` in `test/helpers.ts`). Without keys the API
  boots (dev) and uploads return 503 `MEDIA_NOT_CONFIGURED`. Production requires the keys.
- Public short JSON is viewer-independent and cacheable. Per-viewer likes/saves come from `GET /shorts/engagement?ids=`.
- `Short.operatorActive` is denormalised; `setOperatorStatus()` calls `syncOperatorShorts()`. Feed = published + operatorActive.
- Likes live in `ShortLike` (unique short+user); `Short.likeCount` is the counter. Never add an array of user ids to Short.
- Feed pagination is a cursor (`createdAt` + `_id`), never `skip`.
- Optional page sections (Home row, portfolios) use `serverApiSafe()` so an API hiccup (or `next build` without an API)
  doesn't break the page.
- The feed mounts a `<video>` only for the active item ± 1; others show the poster.

## Conventions

- **TypeScript everywhere**, strict + `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- **API responses**: `{ data, meta? }` on success, `{ error: { code, message, details? } }` on failure. Throw `AppError` (or a `ZodError`); never `res.status(500)` by hand. Wrap async handlers in `asyncHandler` (Express 4).
- **API imports** use `.js` extensions (ESM); `packages/shared` is consumed as TS source (Next `transpilePackages`, tsup `noExternal`).
- **Validation**: Zod on every body/query/params. Shared schemas live in `packages/shared`.
- **Styling**: only design tokens (`bg-ground`, `text-ink`, `border-line`, `text-gold-text`…), never raw hex. Tokens are CSS variables in `app/globals.css` (`:root` = light, `.dark` = dark). Radii: `rounded-input` 12 / `rounded-media` 18 / `rounded-card` 28 / pills `rounded-full`.
- Heading accent word: `<em className="accent">…</em>` (italic gold serif).
- Touch targets ≥ 44px (`h-11`), icon buttons need `aria-label`, animate only transform/opacity.
- Destructive actions use `ConfirmDialog` (never `window.confirm`).
- **Secrets**: only in root `.env` (git-ignored). Add every new var to `.env.example` **and** `apps/api/src/config/env.ts`.
- **Never** return operator phone/WhatsApp from public endpoints (Section 2.1).
- Forms: React Hook Form + `zodResolver(<schema from shared>)` + `applyServerError()` (lib/forms.ts) to map API errors onto fields.
- Don't use `useSearchParams` in components that render on every page (it forces a Suspense boundary); read `window.location` inside handlers instead.
- Sample data must be clearly marked (`[Sample Operator 1]`, `[PRICE]`).
- One commit per phase; log non-obvious choices in `DECISIONS.md`.
