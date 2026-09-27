# Cal.com Integration

## Setup

Register an OAuth app at `app.cal.com/settings/developer/oauth` with:

- **Redirect URI:** `{NEXTAUTH_URL}/api/scheduling/oauth/calcom/callback`
- Copy the Client ID → `CALCOM_CLIENT_ID` in `.env`
- Copy the Client Secret → `CALCOM_CLIENT_SECRET` in `.env`

---

## What Was Done to Fetch Cal.com Meetings

### Problem

Cal.com meetings were not being displayed in the scheduling view despite a Cal.com integration being connected.

Three separate bugs were found and fixed:

---

### Fix 1 — Encryption key length (`src/lib/encryption.ts`)

**Root cause:** `aes-256-cbc` requires exactly 32 bytes for the encryption key. The fallback key was 42 characters and any user-provided `ENCRYPTION_KEY` env var that wasn't exactly 32 bytes caused a `ERR_CRYPTO_INVALID_KEYLEN` crash when saving or reading the Cal.com API token.

**Fix:** Hash the key through SHA-256 before use, which always produces exactly 32 bytes regardless of input length.

```ts
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || 'default-encryption-key-for-dev!!';
  return crypto.createHash('sha256').update(raw).digest();
}
```

---

### Fix 2 — Cal.com client using wrong API version (`src/lib/scheduling/calcom-client.ts`)

**Root cause:** `CalComClient` was pointed at the **v1 API** (`https://api.cal.com/v1`) and used `Authorization: Bearer <token>`. The v1 API authenticates via `?apiKey=` query param, not a Bearer token — so every request returned a 404 "Booking not found" error and no meetings were ever synced.

**Fix:** Migrated `CalComClient` to the **v2 API** (`https://api.cal.com/v2`) with the `cal-api-version: 2024-08-13` header, which properly accepts Bearer tokens. Also updated `cancelBooking` (v1 used `DELETE`, v2 uses `POST /cancel`) and `getBooking` response parsing for the v2 shape (`{ status, data: { ... } }`).

---

### Fix 3 — Sync route only fetched upcoming meetings + wrong status mapping (`src/app/api/scheduling/calcom/sync/route.ts`)

**Root cause 1:** The sync route only requested `status=upcoming` from Cal.com, so past and completed meetings were never imported.

**Fix:** Fetch both `upcoming` and `past` in parallel:

```ts
const [upcomingRes, pastRes] = await Promise.allSettled([
  axios.get('/v2/bookings', { params: { status: 'upcoming', take: 100 } }),
  axios.get('/v2/bookings', { params: { status: 'past',     take: 100 } }),
]);
```

**Root cause 2:** Status values were compared after `.toUpperCase()` (`'ACCEPTED'`, `'CANCELLED'`) but Cal.com v2 returns lowercase (`accepted`, `cancelled`, `past`), so all meetings were mapped to `scheduled` instead of the correct status.

**Fix:** Compare lowercase and handle the `past` status:

```ts
const calStatus = (booking.status ?? '').toLowerCase();
const status =
  calStatus === 'cancelled' ? 'cancelled' :
  calStatus === 'accepted' || calStatus === 'confirmed' ? 'scheduled' :
  calStatus === 'past' ? 'completed' : 'scheduled';
```

**Root cause 3:** The upsert logic used `findFirst` + separate `update`/`create`, which is race-prone and verbose. The schema already has a `@@unique([platformEventId, platform])` constraint.

**Fix:** Use Prisma `upsert` directly on the unique constraint:

```ts
await prisma.meeting.upsert({
  where: { platformEventId_platform: { platformEventId: uid, platform: 'calcom' } },
  update: { ... },
  create: { ... },
});
```

---

### Fix 4 — Meeting details & link not visible in UI (`src/components/scheduling/`)

**Problem:** Clicking a Cal.com meeting card opened the generic "Edit Meeting" form, which showed editable fields irrelevant to an external Cal.com booking, and didn't display the meeting link or attendee details clearly.

**Changes:**

- **`MeetingCard.tsx`** — Cal.com cards now show:
  - The booking description (2-line clamp) directly on the card
  - A persistent purple **"Join Meeting"** button (always visible, not hidden on hover)

- **`MeetingModal.tsx`** — Clicking a Cal.com card now opens a read-only details panel instead of the edit form, showing:
  - Status badge
  - Prominent meeting link with **Join** and **Copy link** buttons
  - Date, time, duration, and timezone
  - Description / notes
  - Attendees list with avatars
  - Linked lead info
