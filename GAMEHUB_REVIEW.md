# GameHub Codebase Review
*Branch: `claude/gracious-shannon-XPvzz` — Generated 2026-06-09*

---

## 1. Upstream PR Summary (hydralauncher/hydra)

Seven open PRs were reviewed. Grouped by theme:

### Features
| PR | Title | Applicability |
|----|-------|---------------|
| #2294 | `feat: add installed indicator to library game cards` | **High** — visual install status badge on cards; straightforward UX win |
| #2295 | `feat: reset executable path when deleting game files` | **High** — prevents broken launch state after file deletion |
| #2296 | `feat(catalogue): show 5 page buttons for multi-page jumps` | **Medium** — improved pagination for large catalogues |
| #2231 | `feat: add emulator support` | **High** — major feature; broad audience appeal for retro titles |

### Bug Fixes
| PR | Title | Applicability |
|----|-------|---------------|
| #2271 | `fix: use absolute path for ldconfig detection` | **High (Linux)** — prevents library detection failures on some distros |
| #2297 | `fix(report-profile): submit report and match API contract` | **Medium** — aligns report submission with current API spec |

### Localization / Chore
| PR | Title | Applicability |
|----|-------|---------------|
| #2291 | `chore: update 1 russian translation string to avoid confusion` | **Low** — minor translation clarity fix |

**Recommended ports to GameHub (priority order):**
1. `#2231` — emulator support (differentiation feature)
2. `#2294` — installed indicator (zero-friction UX improvement)
3. `#2295` — reset executable path on delete (prevents silent breakage)
4. `#2271` — ldconfig absolute path (Linux reliability)
5. `#2296` — catalogue pagination (quality-of-life)

---

## 2. Branding Audit

### Summary: ⚠️ Not rebranded — all assets and config still read "Hydra"

The `gamehub.svg` file (1254×1254, dark geometric mark on white, committed as `ec2753a`) exists at the repo root but is **not referenced or integrated anywhere** in the build pipeline, source code, or config.

### Asset Inventory

| Asset | Location | Current Content | Status |
|-------|----------|-----------------|--------|
| Windows executable icon | `build/icon.ico` (108 KB) | Original Hydra logo | ❌ Needs replacement |
| macOS app icon | `build/icon.icns` (207 KB) | Original Hydra logo | ❌ Needs replacement |
| Generic app icon | `build/icon.png` (20 KB) | Original Hydra logo | ❌ Needs replacement |
| Window/runtime icon | `resources/icon.png` (20 KB) | Original Hydra logo | ❌ Needs replacement |
| System tray icon | `resources/tray-icon.png` (18 KB) | Original Hydra logo | ❌ Needs replacement |
| In-app SVG logo | `src/renderer/src/assets/icons/hydra.svg` | Hydra creature SVG | ❌ Needs replacement |
| Big Picture SVG logo | `src/big-picture/src/assets/hydra-icon.svg` | Hydra creature SVG (identical) | ❌ Needs replacement |
| New brand logo | `gamehub.svg` (8 KB) | GameHub mark — unused | ⚠️ Uploaded, not integrated |

### Config / Text Strings

| Location | Current Value | Action Required |
|----------|---------------|-----------------|
| `package.json` → `name` | `hydralauncher` | Rename to `gamehub` |
| `package.json` → `description` | `"Hydra"` | Update to `"GameHub"` |
| `electron-builder.yml` → `appId` | `gg.hydralauncher.hydra` | Update to new app ID |
| `electron-builder.yml` → `productName` | `Hydra` | `GameHub` |
| `electron-builder.yml` → `win.executableName` | `Hydra` | `GameHub` |
| `electron-builder.yml` → `linux.mimeTypes` | `x-scheme-handler/hydralauncher` | Update scheme handler |
| `electron-builder.yml` → `publish` | `owner: hydralauncher / repo: hydra` | Point to GameHub repo |
| `src/renderer/index.html` → `<title>` | `Hydra Launcher` | `GameHub` |
| `src/big-picture/index.html` → `<title>` | `Hydra Big Picture` | `GameHub Big Picture` |
| `src/main/services/window-manager.ts` | Tray tooltip: `"Hydra Launcher"` | Update string |
| `src/main/services/hydra-api.ts` | User-Agent: `"Hydra Launcher v{version}"` | Update User-Agent |
| 28+ locale JSON files | Multiple `"Hydra"` strings | Mass find-replace |

### What's Correct
- No leftover "GameHub" strings from a prior attempt (clean slate)
- `.env` secrets are not committed — only `.env.example`
- Icon file structure and sizes are suitable for direct asset swap

---

## 3. Code Quality & Feature Proposals

### Overall Assessment: Excellent

| Metric | Finding |
|--------|---------|
| TypeScript/TSX files | 724 |
| Open TODO/FIXME | 1 (`find-achievement-files.ts:56` — minor) |
| Secrets committed | None |
| Security issues | None (no `eval`, proper `spawn` usage, sanitized HTML) |
| ESLint / Prettier | Configured and enforced via Husky pre-commit |
| Dependency currency | Modern: Electron 40, React 18, TypeScript 5.3, Vite 6 |

### Proposed New Features

**1. Game Notes / Journal**
Add a per-game notes field (Tiptap editor already bundled as a dependency) so users can log playthroughs, spoilers, or to-do lists. Zero additional deps; Tiptap is already in `package.json`.

**2. Playtime Goals & Reminders**
Leverage the existing achievements infrastructure to let users set playtime targets per game and receive in-app reminders — natural extension of the achievement toast system.

**3. Steam Deck Battery-Aware Download Scheduling**
When Big Picture mode detects low battery, pause active downloads automatically. The `check-disk-space` and download manager hooks are already in place; this is a glue feature.

**4. Game Collection Tags / Shelves**
Allow users to create named shelves (e.g., "Playing", "Backlog", "Completed") backed by the existing LevelDB layer. `@atlaskit/pragmatic-drag-and-drop` is already installed — drag-to-shelf would work out of the box.

**5. Export / Import Library Backup**
Expose a one-click export of the LevelDB game library + preferences as a JSON zip (using the bundled `7z` binary). Useful for migration between machines and directly complements the cloud sync story.

### Optimisation Opportunities

- **Lazy-load Big Picture assets** — `flame-animated.gif` (230 KB) and `stars-animated.gif` (69 KB) are eagerly imported in renderer; switching to dynamic `import()` would cut initial bundle weight.
- **Deduplicate drag-and-drop libraries** — `react-dnd` + `@atlaskit/pragmatic-drag-and-drop` serve similar purposes; consolidating on one would reduce bundle size.
- **`dangerouslySetInnerHTML` (8 occurrences)** — all in review-display components. Add an explicit DOMPurify pass before render for belt-and-suspenders XSS protection against malicious game description payloads.

---

## 4. Action Checklist

### Branding (required before any public release)
- [ ] Export `gamehub.svg` → `build/icon.png` (512×512, transparent background)
- [ ] Generate `build/icon.ico` (multi-size) and `build/icon.icns` from new PNG
- [ ] Replace `resources/icon.png` and `resources/tray-icon.png`
- [ ] Replace `src/renderer/src/assets/icons/hydra.svg` → GameHub SVG (update all `<img src>` / `import` references)
- [ ] Replace `src/big-picture/src/assets/hydra-icon.svg`
- [ ] Global find-replace `Hydra` → `GameHub` in config files, HTML titles, tray strings, and User-Agent
- [ ] Update `appId`, `executableName`, MIME scheme, and `publish` repo in `electron-builder.yml`
- [ ] Audit all 28+ locale files for "Hydra" strings

### Port from upstream (recommended)
- [ ] Cherry-pick / adapt PR #2231 (emulator support)
- [ ] Cherry-pick / adapt PR #2294 (installed indicator)
- [ ] Cherry-pick / adapt PR #2295 (reset exec path on delete)
- [ ] Cherry-pick / adapt PR #2271 (ldconfig absolute path — Linux)

### Code improvements
- [ ] Add DOMPurify to the 8 `dangerouslySetInnerHTML` sites
- [ ] Lazy-load `flame-animated.gif` and `stars-animated.gif`
- [ ] Resolve the single TODO at `find-achievement-files.ts:56`
