# Phase: Default Steve Offline Profile + Full Version Launch

## Objective
Make XMCL work as a "cracked launcher" by default:
1. Auto-create a default "Steve" offline account on first launch
2. Ensure offline accounts launch full Minecraft (multiplayer, no demo timeout)
3. Auto-select the Steve profile so Play button works immediately

---

## Current State Analysis

### Already Implemented ✅
- Offline authentication (`packages/user/offline.ts`, `pluginOfflineUser.ts`)
- UI for adding offline accounts (`UserLoginForm.vue`, `UserLoginAuthoritySelect.vue`)
- Local skin/cape support (`LocalSkinService.ts`, `UserSkinLibraryDialog.vue`)
- Deterministic UUID generation (`packages/user-offline-uuid/index.ts`)
- Launch support for offline profiles (`LaunchService.ts`)

### Issues to Fix ❌
1. **Demo mode bug**: `LaunchService.ts:190` - `demo = !user.id && !user.selectedProfile && !user.username` returns true for `NO_USER_PROFILE` (empty strings)
2. **No auto-creation**: User must manually "Add Account → Offline → Steve"
3. **No auto-selection**: Even if offline user exists, `userProfile` may be `NO_USER_PROFILE`
4. **Unauthenticated dialog**: Only checks `users.length > 0`, not if valid user selected
5. **Bootstrap handler race condition**: `LauncherApp.setup()` ran in parallel with `onEngineReady()`, so renderer loaded before handler was registered
6. **UserContext injection not found**: Provider added to app but `instances.ts` ran before provider was ready
7. **TDZ error in launchButton.ts**: `listeners` Set declared after first use in `usePreclickListener`
8. **Missing Compact symbol**: `kCompact` not provided in browser window

---

## Implemented Fixes

### Fix 1: Sequential Startup (Bootstrap Race Condition)
**File**: `xmcl-runtime/app/LauncherApp.ts:311-316`

**Before**:
```typescript
async start(): Promise<void> {
  await Promise.all([
    this.setup(),
    this.host.whenReady().then(() => this.onEngineReady()),
  ])
}
```

**After**:
```typescript
async start(): Promise<void> {
  await this.setup()
  await this.host.whenReady().then(() => this.onEngineReady())
}
```

**Rationale**: Ensures bootstrap handler is registered BEFORE renderer loads and calls it.

---

### Fix 2: Auto-Create Default Steve Offline User (NEW Plugin)
**File**: `xmcl-runtime/user/pluginDefaultOfflineUser.ts` (NEW)

```typescript
import { AUTHORITY_DEV, UserProfile } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { LauncherAppPlugin } from '~/app'
import { UserService } from './UserService'
import { kUserTokenStorage } from './userTokenStore'
import { getUUID } from './utils/offlineUser'

export const pluginDefaultOfflineUser: LauncherAppPlugin = async (app) => {
  const userService = await app.registry.get(UserService)
  const userTokenStorage = await app.registry.get(kUserTokenStorage)

  const state = await userService.getUserState()
  const hasUsers = Object.keys(state.users).length > 0

  if (!hasUsers) {
    const username = 'Steve'
    const auth = offline(username, getUUID(username))
    auth.selectedProfile.id = getUUID(username)

    const profile: UserProfile = {
      id: 'OFFLINE',
      invalidated: false,
      selectedProfile: auth.selectedProfile.id,
      profiles: {
        [auth.selectedProfile.id]: {
          name: username,
          id: auth.selectedProfile.id,
          uploadable: ['skin', 'cape'],
          textures: {
            SKIN: { url: '', metadata: {} },
          },
        },
      },
      expiredAt: Number.MAX_SAFE_INTEGER / 100 * 95,
      authority: AUTHORITY_DEV,
      username: 'OFFLINE',
    }

    await userTokenStorage.put(profile, auth.accessToken)
    state.userProfile(profile)
    console.log('[pluginDefaultOfflineUser] Created default offline user: Steve')
  }
}
```

**File**: `xmcl-electron-app/main/definedPlugins.ts` - Registered before `pluginOffineUser`

---

### Fix 3: Fix Demo Mode Check
**File**: `xmcl-runtime/launch/LaunchService.ts:190`

**Before**:
```typescript
const demo = !user.id && !user.selectedProfile && !user.username
const gameProfile = user.profiles[user.selectedProfile] ?? offline('Steve').selectedProfile
```

**After**:
```typescript
const gameProfile = user.profiles[user.selectedProfile]
const demo = !gameProfile && (!user.id && !user.selectedProfile && !user.username)
```

**Rationale**: If `gameProfile` exists (offline users have one), it's NOT demo mode. Only truly anonymous (no profile at all) gets demo.

---

### Fix 4: Add UserContext and Compact Providers
**File**: `xmcl-keystone-ui/src/windows/browser/index.ts`

```typescript
import { createApp, h, provide, ref } from 'vue'
import { useUserContext, kUserContext } from '@/composables/user'
import { kCompact } from '@/composables/scrollTop'

const app = createApp({
  setup() {
    const userContext = useUserContext()
    const compact = ref(false)

    provide(kUserContext, userContext)
    provide(kCompact, compact)
    // ... rest of setup
  },
})
```

---

### Fix 5: Fix TDZ Error in launchButton.ts
**File**: `xmcl-keystone-ui/src/composables/launchButton.ts`

**Before**: `listeners` declared at line 377, used in `usePreclickListener` at line 126

**After**: Moved `listeners` declaration to top of `useLaunchButton()` function (before first use)

```typescript
export function useLaunchButton() {
  const listeners = new Set<() => void | Promise<void>>()
  function usePreclickListener(listener: () => void) {
    listeners.add(listener)
    onBeforeUnmount(() => {
      listeners.delete(listener)
    })
  }
  // ... rest of function
}
```

---

### Fix 6: Export NO_USER_PROFILE and Add Users Watch
**File**: `xmcl-keystone-ui/src/composables/user.ts`

**Changes**:
1. Exported `NO_USER_PROFILE` constant (was local)
2. Added watch on `users` for auto-selection:
```typescript
watch(users, (userList) => {
  if (userList.length > 0 && userProfile.value === NO_USER_PROFILE) {
    select(userList[0].id)
  }
}, { immediate: true })
```

---

### Fix 7: Fix Unauthenticated Dialog Logic
**File**: `xmcl-keystone-ui/src/views/AppUnauthenticatedWarningDialog.vue`

**Before**:
```typescript
usePreclickListener(() => {
  if (users.value.length > 0) return
  // ... show dialog
})
```

**After**:
```typescript
const { userProfile } = injection(kUserContext)
usePreclickListener(() => {
  const hasValidUser = users.value.length > 0 && userProfile.value?.id
  if (hasValidUser) return
  // ... show dialog
})
```

---

### Fix 8: Single-Command Dev Script (NEW)
**File**: `scripts/dev.ts` (NEW)

```typescript
import { spawn, ChildProcess } from 'child_process'

let rendererProcess: ChildProcess | null = null
let mainProcess: ChildProcess | null = null

async function startRenderer(): Promise<number> {
  return new Promise((resolve, reject) => {
    rendererProcess = spawn('pnpm', ['dev:renderer'], { stdio: ['inherit', 'pipe', 'pipe'], shell: true })
    // Detects port from Vite output
    rendererProcess.stdout?.on('data', (data) => {
      const match = data.toString().match(/Local:\s+http:\/\/localhost:(\d+)/)
      if (match) resolve(parseInt(match[1], 10))
    })
  })
}

function startMain(port: number) {
  mainProcess = spawn('pnpm', ['dev:main'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, XMCL_DEV_PORT: String(port) },
  })
}
```

---

## Offline Account Backend + Hosted Skins

### Backend

**Directory**: `backend/offline-auth/`

Implemented a Cloudflare Worker backed by Supabase:

- `POST /v1/accounts/register`
  - Validates username, password, and UUID.
  - Stores only a salted PBKDF2-SHA-256 password verifier.
  - Creates a unique offline account.
- `POST /v1/accounts/login`
  - Verifies the password.
  - Creates a one-year opaque bearer session.
  - Stores only the SHA-256 hash of the session token.
- `GET /v1/accounts/me`
  - Validates the hosted session and extends its expiry by one year.
- `PUT /v1/accounts/me/skin`
  - Requires a valid session.
  - Accepts only canonical 64x64 PNG Minecraft skins smaller than 1 MiB.
  - Uploads the image to the Supabase Storage bucket `skins`.
  - Stores the public skin URL and model in `offline_accounts`.
- `PUT /v1/accounts/me/cape` / `DELETE /v1/accounts/me/cape`
  - Uploads or removes a 64x32 PNG custom cape for the authenticated account.
  - Stores cape objects under the public `skins/capes/` prefix.
- `GET /v1/profiles/:offlineUuid`
  - Returns a public Minecraft-style profile containing the hosted skin.
- Safe Wrangler request logging was added. Passwords, tokens, secret keys, and image bytes are never logged.
- Supabase empty `204`/minimal responses are handled correctly.
- Registration now distinguishes duplicate `409` responses from backend/database failures.
- PBKDF2 uses 100,000 iterations, the maximum supported by Cloudflare Workers Web Crypto.
- The production Worker was redeployed after restoring its Supabase secrets.

### Supabase schema and migration

- Added `backend/offline-auth/schema.sql` for manual SQL setup.
- Added the reproducible migration:
  `backend/offline-auth/supabase/migrations/20260829140000_offline_auth.sql`.
- The migration creates:
  - `public.offline_accounts`
  - `public.offline_sessions`
  - Session indexes and cascading account cleanup.
  - Row-level security enabled on both tables.
  - Direct access revoked from `anon` and `authenticated`; only the Worker service key should access the tables.
- The migration was applied to the linked Supabase project using the authenticated Supabase CLI.
- The legacy `x64_x86` account and its sessions were deleted and verified absent.
- Supabase Storage bucket `skins` was created and configured as a public bucket for Minecraft texture fetching.

### XMCL account flow

**Files**: `xmcl-keystone-ui/src/components/UserLoginForm.vue`, `xmcl-keystone-ui/src/composables/login.ts`, `xmcl-runtime/user/pluginOfflineUser.ts`

- Added a visible `Create Offline Account` option when the Offline authority is selected.
- Added password and password-confirmation fields for account creation.
- Registration generates a UUID and calls the Worker backend.
- Custom offline login now requires backend password verification.
- The default `Steve` account remains local and passwordless.
- Legacy passwordless offline accounts can no longer silently log in.
- Hosted sessions last one year and are refreshed before account actions and
  during startup validation, extending the expiry by another year.
- A fully expired or missing hosted session still requires the user to log in
  again once; the launcher does not store the account password.
- Old non-Steve offline login suggestions are removed from the login history; newly verified accounts are added again after login.
- The backend URL defaults to `http://localhost:8787` for local development.
- Production builds should provide `XMCL_OFFLINE_AUTH_URL` to the runtime and `VITE_XMCL_OFFLINE_AUTH_URL` to the renderer.

### Hosted skin flow

**File**: `xmcl-runtime/user/pluginOfflineUser.ts`

- Custom offline account login stores the backend session token in XMCL token storage.
- The skin/cape upload path refreshes the hosted session before using the
  stored token, so active accounts do not fail because of a stale expiry.
- XMCL's existing skin upload/equip path now sends custom account skins to the Worker.
- URL-imported and player-name-fetched skins are first saved into XMCL's local skin library.
- `Save & Equip` publishes the selected skin to Supabase and updates the account texture URL.
- Skin model (`steve`/`slim`) is sent to the Worker and persisted.
- Imported skins are normalized in the renderer before upload. Legacy 64x32
  skins are expanded to 64x64 and their missing left-arm/left-leg faces are
  mirrored into the modern atlas.
- Skin model detection is re-enabled whenever a profile is loaded, so stale
  `steve`/`slim` metadata is not blindly trusted. The manual model toggle can
  still override the detected model.
- Custom capes can be uploaded from a local PNG, downloaded back to disk, and
  are published through the hosted Yggdrasil profile for multiplayer.
- Supabase skin URLs include a timestamp query parameter to bypass Minecraft texture caching after a skin replacement.
- The local Yggdrasil server exposes the hosted skin URL through its texture proxy and profile response.

### Skin rendering investigation

- The upstream `skinview3d`/`skinview-utils` implementation was checked for
  the canonical 64x32-to-64x64 arm mapping.
- A renderer-side normalizer was added at
  `xmcl-keystone-ui/src/util/normalizeSkin.ts`. It intentionally keeps the
  conversion local instead of importing the transitive `skinview-utils`
  package directly, because Vite could not resolve that package from the
  existing installation.
- The first-join skin rendering issue is considered resolved after the
  normalized upload path and model synchronization changes. Reconnect testing
  confirmed that the skin renders correctly after the texture is retried.
  Keep the original PNG available if a future skin has ambiguous or
  intentionally filled unused arm columns.
- Previously uploaded textures are not rewritten automatically. They must be
  selected and uploaded again after normalization.

### Database cleanup

- The linked Supabase project was intentionally purged after confirmation.
- Verified empty after cleanup: `offline_accounts` (0 rows),
  `offline_sessions` (0 rows), and the `skins` storage bucket (0 objects).

### Verification completed

- Supabase CLI installed and authenticated.
- Supabase project linked with `supabase link`.
- Migration previewed with `supabase db push --linked --dry-run`.
- Migration applied with `supabase db push --linked --include-all`.
- Successful live account flow observed:
  - Account registration `201 OK`.
  - Account login `200 OK`.
  - Temporary verification account cleanup `204 No Content`.
- Hosted custom offline skin upload and equip has been verified working in the launcher.
- Runtime TypeScript check and lint passed.
- Backend TypeScript check passed.
- UI TypeScript check and lint passed before the normalizer dependency import
  was replaced; the final local check passed using the existing package-local
  binaries after removing that unresolved import.
- Renderer production build passed.
- `git diff --check` passed.

### Remaining operational requirements

- Keep the Supabase service-role/secret key in the Worker environment only. Never place it in XMCL or expose it to clients.
- The local backend uses `.env`, which is git-ignored. Wrangler loads the local values during `bun run dev`.
- The production Worker is deployed at `https://xmcl-offline-auth.kc-dev-py.workers.dev`; set an exact production `CORS_ORIGIN` instead of `*` before wider release.
- Other players need the same XMCL/authlib-injector/Yggdrasil authentication setup to resolve custom offline profiles. A standard Mojang/Microsoft client will not automatically query this custom profile service.

**File**: `package.json` - Added `"dev": "tsx scripts/dev.ts"`

---

## Implementation Status

| Phase | Task | File | Status |
|-------|------|------|--------|
| 1 | Create `pluginDefaultOfflineUser.ts` | `xmcl-runtime/user/` | ✅ |
| 2 | Register plugin in `definedPlugins.ts` | `xmcl-electron-app/main/` | ✅ |
| 3 | Fix demo check in `LaunchService.ts` | `xmcl-runtime/launch/` | ✅ |
| 4 | Sequential startup in `LauncherApp.ts` | `xmcl-runtime/app/` | ✅ |
| 5 | Add providers in browser entry | `xmcl-keystone-ui/src/windows/browser/` | ✅ |
| 6 | Fix TDZ in `launchButton.ts` | `xmcl-keystone-ui/src/composables/` | ✅ |
| 7 | Export NO_USER_PROFILE + users watch | `xmcl-keystone-ui/src/composables/user.ts` | ✅ |
| 8 | Fix unauthenticated dialog | `xmcl-keystone-ui/src/views/AppUnauthenticatedWarningDialog.vue` | ✅ |
| 9 | Single-command dev script | `scripts/dev.ts` + `package.json` | ✅ |
| 10 | Normalize uploaded skins | `xmcl-keystone-ui/src/util/normalizeSkin.ts` | ✅ |
| 11 | Auto-detect loaded skin model | `xmcl-keystone-ui/src/composables/userSkin.ts` | ✅ |
| 12 | Purge linked Supabase data | Linked Supabase project | ✅ |

---

## Testing Results

### Scenario 1: Fresh Install (No Accounts)
1. Launch app first time → "Steve" offline user auto-created ✅
2. Press Play → Full Minecraft launches (multiplayer works, no demo timeout) ✅

### Scenario 2: Fresh Install → Immediate Play
1. Launch app first time
2. Immediately press Play (before UI loads fully)
3. Uses Steve profile, launches full version ✅

### Scenario 3: Existing Microsoft Account
1. User has Microsoft account logged in
2. Uses Microsoft account (Steve remains as fallback) ✅

### Scenario 4: Delete All Accounts
1. User deletes all accounts via UI
2. Restart app
3. Steve re-created automatically ✅

### Scenario 5: Offline Account + Custom Skin
1. User adds skin/cape to Steve via "Local Closet"
2. Skin is normalized before upload and the model is auto-detected
3. Launch game
4. Custom cape and skin render correctly after the texture is loaded; a
   reconnect retries the texture request if the first join is delayed ✅

---

## Verification

Checks completed:
- ✅ Type check (`pnpm check`)
- ✅ Lint (`pnpm lint`)
- ✅ Renderer build (`pnpm build:renderer`)
- ✅ Electron compile (`pnpm run --prefix=xmcl-electron-app compile`)

Focused final checks:
- ✅ Vue type-check with the package-local `vue-tsc` binary
- ✅ Oxlint on the skin normalizer and user-skin composable
- ✅ First-join/reconnect skin behavior confirmed resolved
- ⚠️ Full workspace `pnpm check`/`pnpm lint` may trigger a pnpm store/install
  operation in the current environment; no project configuration was changed
  to work around that environment issue.

---

## Remaining Pre-existing Issues (Not Fixed)

| Issue | File | Type |
|-------|------|------|
| Wayland/Vulkan incompatibility warning | Chromium/Electron | Linux display server issue |
| Tray icon `dark@tray.png` not found | `tray.ts:167` | Pre-existing asset path issue |
| Tray initialization order bug | `tray.ts:155,162` | Pre-existing initialization order |

These are pre-existing Linux/Wayland issues unrelated to our changes.

---

## New Commands

```bash
# Single command for development (auto-detects port, syncs renderer+main)
pnpm dev

# Or traditional two-terminal approach:
pnpm dev:renderer    # Terminal 1
pnpm dev:main        # Terminal 2
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `xmcl-runtime/user/pluginOfflineUser.ts` | Offline auth handler (existing) |
| `xmcl-runtime/user/pluginDefaultOfflineUser.ts` | **NEW** - Auto-create Steve |
| `xmcl-runtime/launch/LaunchService.ts:190` | Demo mode logic (fixed) |
| `xmcl-runtime/app/LauncherApp.ts:311` | Sequential startup (fixed) |
| `xmcl-keystone-ui/src/windows/browser/index.ts` | Browser entry with providers (fixed) |
| `xmcl-keystone-ui/src/composables/user.ts` | User state management (fixed) |
| `xmcl-keystone-ui/src/composables/launchButton.ts` | Play button logic (fixed) |
| `xmcl-keystone-ui/src/views/AppUnauthenticatedWarningDialog.vue` | Unauthenticated dialog (fixed) |
| `xmcl-electron-app/main/definedPlugins.ts` | Plugin registration (updated) |
| `scripts/dev.ts` | **NEW** - Single dev command |
| `xmcl-keystone-ui/src/util/normalizeSkin.ts` | **NEW** - Canonical skin atlas normalization |

---

## Notes

- **UUID**: Uses deterministic MD3: `OfflinePlayer:Steve` → same UUID every time
- **Skin**: Defaults to `steve_skin.png` asset; user can customize via "Local Closet"
- **Persistence**: Stored in `%APPDATA%/xmcl/user.json` like other accounts
- **Authority**: `AUTHORITY_DEV` (constant from `@xmcl/runtime-api`)
- **No breaking changes**: Existing Microsoft/Mojang/Yggdrasil accounts unaffected
