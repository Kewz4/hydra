# GameHub Codebase Audit Report

_Branch: `claude/gracious-shannon-XPvzz` — Generated 2026-06-08_

---

## 1. Pull Request Summary

No open or closed pull requests exist on `kewz4/hydra` at this time. The repository is a fresh fork with no community-contributed PRs yet. For reference, the upstream `hydralauncher/hydra` project (which this is forked from) regularly receives contributions in the following themes — each category has direct applicability to GameHub:

| Theme                       | Upstream pattern                                                 | Applicability to GameHub                                                         |
| --------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **UI / UX improvements**    | Catalogue filters, game card redesigns, Big Picture polish       | Directly applicable — use as inspiration for GameHub-specific UI differentiation |
| **Download engine fixes**   | Debrid provider bug fixes, progress reporting, extraction errors | Port directly; these are backend-agnostic                                        |
| **Achievement system**      | Comparison panels, notification tweaks, unlocked-count display   | Already partially integrated; watch upstream for new game coverage               |
| **Cloud save (HydraCloud)** | Conflict resolution, sync state display                          | Rebrand strings to "GameHub Cloud" where missed                                  |
| **Localisation**            | New languages, string corrections                                | Safe to cherry-pick; translation keys are language-agnostic                      |
| **Platform / runtime**      | Electron version bumps, Rust native addon improvements           | Evaluate carefully — may require re-testing GameHub-specific integrations        |
| **Bug fixes**               | Crash on empty library, tray-icon behaviour, shortcut creation   | Low-risk to cherry-pick after reading the diff                                   |

**Recommendation:** Subscribe to upstream releases (GitHub "Watch → Releases only") and periodically rebase or cherry-pick relevant commits onto `main`.

---

## 2. Branding Audit

### ✅ Correctly Rebranded

| Asset / Setting                           | Value                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `electron-builder.yml` → `productName`    | `GameHub`                                                              |
| `electron-builder.yml` → `executableName` | `GameHub`                                                              |
| `electron-builder.yml` → `appId`          | `io.gamehub.launcher`                                                  |
| `electron-builder.yml` → `owner`          | `Kewz4`                                                                |
| `package.json` → `description`            | `"GameHub"`                                                            |
| GameHub SVG logo                          | `src/renderer/src/assets/icons/gamehub.svg` (2.8 KB, added 2026-06-08) |
| Big-Picture SVG                           | `src/big-picture/src/assets/gamehub-icon.svg`                          |
| All locale display strings                | Show "GameHub" / "GameHub Cloud" in `en/translation.json`              |

### ⚠️ Remaining Inconsistencies

#### A. `package.json` — `name` field still `"hydralauncher"`

```json
// package.json
"name": "hydralauncher"   // ← should be "gamehub" or "gamehub-launcher"
```

This affects the Electron `app.getName()` fallback and any tooling that reads `package.json`.

#### B. Deep-link protocol still `hydralauncher://`

Eleven locations across the source code hard-code this scheme:

| File                                                              | Line context                       |
| ----------------------------------------------------------------- | ---------------------------------- |
| `src/main/index.ts`                                               | `const PROTOCOL = "hydralauncher"` |
| `src/renderer/src/pages/game-details/hero/hero-panel-actions.tsx` | Link generation                    |
| `src/renderer/src/pages/catalogue/game-item.tsx`                  | Link generation                    |
| `src/main/services/game-files-manager.ts`                         | `hydralauncher://run?…`            |
| `src/main/services/window-manager.ts`                             | Auth redirect handling             |
| `src/main/events/library/create-game-shortcut.ts`                 | Shortcut URL                       |
| `electron-builder.yml` → `mimeTypes`                              | `x-scheme-handler/hydralauncher`   |

**Fix:** Change `PROTOCOL` constant in `src/main/index.ts` to `"gamehub"` and update the MIME type in `electron-builder.yml`. All generated links will update automatically.

#### C. Import variable name `HydraIcon` (cosmetic, 9 files)

Nine files import `gamehub.svg` but bind it to `HydraIcon`. Two files (`app.tsx`, `onboarding.tsx`) already use `GameHubIcon` as the correct name.

Files to rename:

| File                                                                                 | Current import alias | Fix to        |
| ------------------------------------------------------------------------------------ | -------------------- | ------------- |
| `src/renderer/src/components/achievements/notification/achievement-notification.tsx` | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/game-launcher/game-launcher.tsx`                             | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/profile/profile-content/user-stats-box.tsx`                  | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/profile/profile-content/user-library-game-card.tsx`          | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/installer/installer.tsx`                                     | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/achievements/achievement-panel.tsx`                          | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/achievements/compared-achievement-panel.tsx`                 | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/achievements/achievement-list.tsx`                           | `HydraIcon`          | `GameHubIcon` |
| `src/renderer/src/pages/achievements/notification/achievement-notification.tsx`      | `HydraIcon`          | `GameHubIcon` |

#### D. Locale translation _keys_ retain `hydra_` prefix

Display strings say "GameHub" correctly, but key names expose the old brand to any future translators:

```
settings_category_hydra_cloud      → settings_category_gamehub_cloud
hydra_needs_to_remain_open         → gamehub_needs_to_remain_open
hydra_cloud (×3 occurrences)       → gamehub_cloud
open_hydra                         → open_gamehub
```

This is low urgency (keys are internal), but should be cleaned up before accepting external translation contributions.

#### E. Binary names `hydra-python-rpc` / `hydra-native`

Binaries embedded in the installer still use the Hydra name. These are internal and not visible to end-users, so this is low priority. Renaming requires rebuilding the Python RPC and Rust binaries and updating all references in `src/main/services/python-rpc.ts` and `src/main/services/native-addon.ts`.

#### F. Executable icon assets — verify visually

The files `build/icon.ico`, `build/icon.png`, `build/icon.icns`, `resources/icon.png`, and `resources/tray-icon.png` cannot be verified programmatically. **Manually confirm** each renders the GameHub logo (not the original Hydra flame) before the next production build.

---

## 3. Code Quality & Feature Proposals

### Security (High Priority)

**S-1 — Sandbox disabled on all windows**
`src/main/services/window-manager.ts` sets `sandbox: false` on all eight `BrowserWindow` instances. This disables Chromium's process sandbox.

- Fix: enable sandbox for any window that does not strictly need a preload script with Node access.

**S-2 — Unvalidated `local:` custom protocol**
`src/main/index.ts` decodes URI with `decodeURI()` before serving files, without a bounds check. A crafted URL could escape the intended directory.

- Fix: after resolution, assert `resolvedPath.startsWith(allowedBasePath)`.

**S-3 — SVG gradient protocol injects unsanitized color values**
The `gradient:` protocol injects `color1`/`color2` directly into an SVG `stop-color` style. If a color string contains semicolons or quotes it could break out of the CSS value.

- Fix: validate with `/^#[0-9a-fA-F]{3,8}$|^rgb\(|^hsl\(/` before interpolation.

**S-4 — CORS headers set to `*` globally**
The `onHeadersReceived` hook in `window-manager.ts` adds `access-control-allow-origin: *` to all responses. Restrict to the app's own protocol or specific trusted origins.

### Reliability (Medium Priority)

**R-1 — Silent `.catch(() => {})` blocks (30+ occurrences)**
Errors are swallowed without logging throughout `src/main/`, making production debugging very hard.

- Fix: replace with `.catch((err) => logger.warn("<context>", err))`.

**R-2 — No React Error Boundary in renderer**
Any uncaught React render error crashes the entire renderer process. Add an `<ErrorBoundary>` at the root in `src/renderer/src/main.tsx`.

**R-3 — IPC payloads not runtime-validated**
IPC handlers rely on TypeScript types, which are erased at runtime. Add lightweight schema validation (e.g., `zod`) at IPC entry points to catch malformed calls from future third-party extensions.

### Feature Proposals

**F-1 — GameHub-branded deep-link scheme (`gamehub://`)**
Completing the protocol rename (see §B above) enables a cleaner user-facing experience and disambiguates GameHub shortcuts from any original Hydra installation on the same machine.

**F-2 — Achievement sharing card**
When a user unlocks an achievement, render a shareable image card (canvas or SVG) containing the game art, achievement icon, and GameHub branding. Expose via a "Share" button on the achievement notification. Low build complexity, high community visibility.

**F-3 — Game time budget / session reminders**
Add a per-game daily/weekly time limit in settings. Use the existing play-time tracking already in `src/main/` to fire a native notification when the budget is reached. Useful differentiator vs. upstream Hydra.

**F-4 — Library import from Steam/GOG**
Detect installed Steam and GOG libraries on disk and offer a one-click "import existing games" flow during onboarding. The Steam library paths (`libraryfolders.vdf`) are easily parseable. This would significantly improve first-run experience.

**F-5 — Offline mode graceful degradation**
Currently network errors can surface as unhandled rejections. Add an `isOffline` Redux state flag (sourced from `navigator.onLine` + IPC ping) and suppress cloud-dependent UI elements when offline, showing a subtle banner instead.

---

## Summary

| Area                                     | Status                                        |
| ---------------------------------------- | --------------------------------------------- |
| Open PRs                                 | None — fresh fork                             |
| Electron-builder / app config branding   | ✅ Complete                                   |
| SVG logo assets                          | ✅ Present and referenced                     |
| Deep-link protocol (`hydralauncher://`)  | ⚠️ Needs rename → `gamehub://`                |
| `package.json` name                      | ⚠️ Still `hydralauncher`                      |
| Import variable names (`HydraIcon`)      | ⚠️ 9 files need rename to `GameHubIcon`       |
| Locale translation keys                  | ⚠️ Low urgency cleanup                        |
| Build icon assets (ico/icns/png)         | ⚠️ Verify visually                            |
| Security (sandbox, protocols, CORS)      | ⚠️ Recommend addressing before public release |
| Reliability (error handling, boundaries) | ⚠️ Medium priority                            |
