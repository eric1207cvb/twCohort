# Repository Guidelines

## Project Structure & Module Organization
This repository contains a Google Apps Script (GAS) web app for 駐站護理師工時調派. The active deployment target lives at the repository root:

- `code.js`: GAS backend entry points, authorization checks, spreadsheet reads/writes, Script Properties storage, official holiday cache refresh, and dispatch validation logic.
- `index.html`: single-page frontend with inline CSS/JS for schedule views, station management, dispatch forms, yearly fairness statistics, and Excel export.
- `env.js`: environment-specific constants such as `ENV.DISPATCH_SOURCE_SHEET_ID`, sheet gids, tester rules, and write-safety flags.
- `appsscript.json`: GAS runtime, OAuth scopes, timezone, and web app execution/access settings.
- `AGENTS.md`: repository operating instructions for coding agents.

There are no active `example/`, `conductor/`, or local build directories in the current project tree. Treat any newly added non-root material as reference-only unless the deployment target is intentionally moved.

Keep frontend and backend changes in sync. If you add, rename, or remove a `google.script.run` call in `index.html`, update the corresponding public function and response shape in `code.js` in the same change.

## Build, Test, and Development Commands
There is no local build pipeline or package manager configured. Development is done by editing these files and pasting or syncing them into Google Apps Script.

- `git status --short`: review pending changes before editing or deploying.
- `git diff -- code.js index.html env.js appsscript.json AGENTS.md`: inspect the active app files together.
- `rg "^function |google\\.script\\.run|ENV\\.|APP_CONFIG|LockService|PropertiesService|CacheService|UrlFetchApp" code.js index.html env.js appsscript.json`: trace key integration points quickly.
- `rg "getDispatchAppData|getDispatchFairnessStats|saveWorkHourDispatch|saveWorkHourDispatchBatch|savePendingWorkHourDispatch|assignPendingWorkHourDispatch|deleteWorkHourDispatch|createStation|deleteStation" code.js index.html`: trace the main frontend/backend contract.

Run and verify through the deployed GAS web app. The manifest currently uses `Asia/Taipei`, V8 runtime, `executeAs: USER_DEPLOYING`, and domain access.

## Coding Style & Naming Conventions
Use 2-space indentation in JavaScript, HTML, CSS, and JSON. Prefer simple vanilla JavaScript with inline CSS/JS in GAS HTML files, matching the current app structure. Keep user-facing text in Traditional Chinese (`zh-TW`). Use comments sparingly and keep them consistent within the surrounding file.

Use:

- `camelCase` for variables and functions, for example `getDispatchAppData` and `saveWorkHourDispatch`.
- trailing underscore for private backend helpers, for example `normalizeWorkHourPayload_`.
- clear uppercase constants for top-level config objects, for example `APP_CONFIG`, `FIELD_ALIASES`, and `ENV`.
- descriptive sheet/tab names such as `人員主檔`, `人員職務配置`, and `組織架構樹`.

## Configuration Notes
- `env.js` is required for environment-specific configuration. Keep spreadsheet IDs, gids, tester allowlists, and environment flags there instead of `index.html`.
- `ENV.DISPATCH_SOURCE_SHEET_ID` must point to the independent dispatch spreadsheet. It must not equal `ENV.CHRM_MASTER_SHEET_ID`; `code.js` explicitly blocks that configuration.
- The source spreadsheet is expected to provide `人員主檔`, `人員職務配置`, and usually `組織架構樹`. `code.js` prefers configured gids for personnel and assignment sheets, then falls back to sheet names or header detection where available.
- `ENV.DISPATCH_PERSONNEL_SHEET_GID` and `ENV.DISPATCH_ASSIGNMENT_SHEET_GID` should be kept current to avoid reading the wrong same-named tab.
- `ENV.MASTER_DATA_READ_ONLY` should remain `true` unless the task explicitly requires changing master-data write behavior.
- `ENV.SYNC_TEMPORARY_DISPATCH_COLUMN` controls whether saved temporary dispatch summaries are written back to the `臨時調配` column in `人員職務配置`.
- `ENV.TESTER_EMAILS` and `ENV.TESTER_TITLES` gate test mode. Test mode uses separate annual dispatch/audit sheets plus Script Properties keys for created stations and hidden station codes.
- `ENV.DISPATCH_HOLIDAY_DATA_URL`, when present, overrides the official government holiday CSV URL.

## Backend / Frontend Contract
- `doGet()` must continue serving `index` unless you intentionally rename the HTML file and update both sides together.
- Public backend functions called from the frontend include `getDispatchAppData`, `getDispatchFairnessStats`, `getStationHeadcountByDate`, `saveWorkHourDispatch`, `saveWorkHourDispatchBatch`, `deleteWorkHourDispatch`, `createMobileStation`, and `deleteMobileStation`.
- Reservation (預約駐站) public functions: `saveStationReservation` (step 1 route + step 2 headcount), `assignStationReservation` (step 3 assign people), `deleteStationReservation` (soft cancel), `getStationReservations` (read-only list), and `getStationSupportLookup` (reverse lookup of who supports a destination station). See the `## Reservation (預約駐站)` section below.
- `savePendingWorkHourDispatch` / `assignPendingWorkHourDispatch` are **deprecated** — the frontend no longer creates pending demand through them (the reservation wizard replaces that flow). They remain callable only so that clients still holding a stale page can finish assigning legacy `assignmentStatus:'待指派'` records until `migratePendingDispatchToReservations()` is run.
- Holiday maintenance functions include `authorizeOfficialHolidayCalendar`, `refreshOfficialHolidayCalendarCache`, `installOfficialHolidayRefreshTrigger`, and `removeOfficialHolidayRefreshTrigger`. These depend on `UrlFetchApp`, `ScriptApp`, `CacheService`, and `PropertiesService` scopes in `appsscript.json`.
- Dispatch mutations must keep `LockService` protection, record version checks, overlap checks, temporary dispatch cooldown checks, and audit log writes intact.
- Saved dispatch records and audit logs are stored in hidden annual sheets such as `調派紀錄_2026` and `調派操作紀錄_2026`. Legacy Script Properties chunks are migrated into those annual sheets on first read. Keep `APP_CONFIG.maxDispatchRecordsPerYear` and `APP_CONFIG.maxDispatchAuditLogsPerYear` in mind when changing record shape.
- Source data is read with alias-based header lookup. If you add source columns or rename existing columns, update `FIELD_ALIASES` and any writer logic such as `appendStationRecord_`, `ensureStationManagerAssignment_`, and `syncTemporaryDispatchColumn_`.
- Preserve response shapes used by `index.html`: frontend code expects `success`, `message`, `viewer`, `stations`, `nurses`, `records`, `scheduleRecords`, `currentRecords`, `reservations`, `holidays`, `holidaySource`, `filters`, `shiftOptions`, and `managerCandidates` from `getDispatchAppData`. `nurses` and each `station.members` entry carry `licenseType` and `isLicensed` (護理師/醫檢師 執照 from source column H). `records`/`scheduleRecords`/`currentRecords` may contain read-only reservation-demand projections (id prefixed `reservation:`, `assignmentStatus:'待指派'`) that must never be persisted or deleted through dispatch mutations.

## Data & Permission Model
- The active user comes from `Session.getActiveUser().getEmail()`. Empty email should remain a hard failure for data loading and mutations.
- Station manager permissions are derived from assignments and station relationships. Do not rely on frontend controls for authorization; backend assertions such as `assertCanManageStation_`, `assertCanAdministrateStation_`, and `assertCanCreateStation_` must remain authoritative.
- The app blocks unavailable personnel statuses such as 育嬰 and 留停 through `APP_CONFIG.unavailableStatusKeywords`.
- Station creation/deletion writes `組織架構樹` and station manager assignment rows in formal mode, but uses test-only stored overrides in test mode.
- Official holiday data is loaded from the government CSV, cached per year, and refreshed by a daily trigger around `APP_CONFIG.holidayRefreshHour`.

## Reservation (預約駐站)
Three-step advance planning that replaces the old single-person pending flow. Steps can be completed at different times but must be done in order (step 2 needs step 1; step 3 needs step 2):
1. Route: which source station (A) supports which destination station (B), plus the support date range and shift.
2. Headcount: how many people A sends to B (`demandCount`).
3. Assign: pick the specific people from A to send to B (one or many at a time, up to the remaining quota).

- **Storage**: a visible, column-based sheet `預約紀錄` (test mode: `測試預約紀錄`) in the writable data spreadsheet (`DISPATCH_DATA_SHEET_ID`), header constant `RESERVATION_SHEET_HEADERS_`, A-column `預約ID` (UUID) as the upsert key. **Nothing is written to Script Properties** — capacity risk is unchanged. Data layer: `getReservationSheet_`, `readStoredReservations_` (45s CacheService cache), `saveStoredReservation_` (single-row upsert + cache invalidation), `reconcileReservations_`. `APP_CONFIG` keys: `reservationSheetName`, `testReservationSheetName`, `reservationsCacheKey`, `testReservationsCacheKey`, plus the composition rule keys `licensedLicenseKeywords`, `reservationMinHeadcount` (2), `reservationMinLicensedCount` (1).
- **Single source of truth**: person-at-station truth stays in the annual dispatch records. A reservation row only stores intent + progress snapshot. Step 3 creates one **standard** dispatch record per person (with a `reservationId` back-link; `normalizeStoredDispatchRecord_` preserves it) and reuses overlap/cooldown checks and `syncTemporaryDispatchColumn_`. `reconcileReservations_` recomputes `assignedCount`/summary from still-active records, so deleting an assigned dispatch on the calendar automatically rolls the reservation progress back.
- **Read-time projection**: `buildReservationDemandProjections_` turns unfilled demand (demand set, `assigned < demand`) into pending-shaped read-only pseudo-records injected into `getDispatchAppData` (calendar/records) and `getDispatchFairnessStats` (待確認 rows). These carry id `reservation:<id>` and are never persisted. The frontend routes assign/delete on `reservation:`-prefixed ids to the reservation wizard instead of the dispatch mutations.
- **Composition rule (warn, don't block)**: destination station must have ≥2 people and ≥1 with a 護理師/醫檢師 license on every day of the range. `buildReservationLicenseWarnings_` computes per-day warnings (soft-capped at `defaultRangeDays` = 31 days); `assignStationReservation` returns `{needsConfirmation:true, warnings}` when unmet and `confirmWarnings` is falsy — the frontend confirms, then re-sends with `confirmWarnings:true`.
- **Protections**: all reservation writes keep `LockService`, an optimistic version check via `assertReservationVersion_` (dedicated reservation-vocabulary messages, not `assertDispatchRecordVersion_`), duplicate-route check `assertNoDuplicateReservation_`, audit logs with the four new actions `create-reservation`/`update-reservation`/`assign-reservation`/`delete-reservation` (whitelisted in `normalizeAuditAction_`/`getDispatchAuditActionLabel_`), and formal/test split via `isTestDispatchRecordStore_`.
- **License chain**: source column H `相關執照` is read via `FIELD_ALIASES.license` (fallback index 7) in `readAssignmentRecords_`; `isLicensedNurseOrMedTech_` classifies it; `buildDispatchContext_` exposes `licenseType`/`isLicensed` on `nurses` and `station.members`.
- **Reverse lookup**: `getStationSupportLookup(payload)` merges (a) active reservations targeting B (with stage label) and (b) confirmed incoming temporary dispatches to B within the range, returning `rows` for the 反查支援 modal.
- **Migration**: `migratePendingDispatchToReservations()` (manual, run in the GAS editor) converts existing `assignmentStatus:'待指派'` records into reservation rows (reusing the original id for idempotency, `demandCount:1`) for both formal and test stores, removes them from the annual sheets, and writes `delete-pending` + `create-reservation` audit logs.
- **Deploy**: `deployAllSheets()` and `deployVerify()` (deploy.js) create/verify both `預約紀錄` and `測試預約紀錄`.

## Testing Guidelines
No automated test framework is configured yet. Validate changes manually in the deployed GAS web app.

Before opening a PR or deploying, verify:

1. `doGet()` loads `index.html` without filename mismatches.
2. `env.js` is present and `ENV.DISPATCH_SOURCE_SHEET_ID` points to a reachable independent spreadsheet.
3. `appsscript.json` scopes still cover spreadsheets, user email, external request, script storage, and script triggers when holiday refresh behavior is used.
4. `getCurrentUserEmail()` returns the expected account in the deployed environment.
5. `getDispatchAppData()` loads viewer, stations, nurses, dispatch records, current records, holiday metadata, and manager candidates.
6. Creating, editing, deleting, batch dispatching, pending assignment, and assigning pending demand all refresh the calendar and yearly records correctly.
7. Conflict handling still works for stale versions, overlapping nurse dispatches, duplicate pending demands, and temporary dispatch cooldown violations.
8. Test mode does not write formal station rows or formal dispatch stores, and formal mode does not use test-only records.
9. Station creation/deletion updates the expected formal sheets only when allowed.
10. Official holiday authorization, manual refresh, and installed daily trigger work after deployment.
11. Yearly fairness statistics and browser-side `.xlsx` export still render expected records, station stats, nurse stats, and audit logs.

## Commit & Pull Request Guidelines
Follow the existing Git history: short, imperative English subjects such as `Add initial implementation of backend logic`. Keep commits focused on one change.

PRs should include:

- a brief summary of user-visible behavior;
- any Google Sheet, Apps Script manifest, OAuth scope, trigger, or deployment changes;
- screenshots for UI edits;
- manual test notes covering data loading, dispatch mutations, station management, holiday refresh, and result storage.

## Security & Configuration Tips
Avoid hardcoding spreadsheet IDs, personal data, or secrets in frontend code. Treat all client data as untrusted and validate it in `code.js` before reading or writing Sheets or Script Properties.

- Keep external spreadsheet IDs in `env.js` or Apps Script-managed configuration, not in `index.html`.
- Do not expose production spreadsheet IDs, user emails, audit logs, or internal dispatch data in screenshots or shared docs.
- Keep backend authorization checks in place even when UI controls already hide actions.
- Keep `LockService` around write paths to avoid concurrent edits corrupting Script Properties stores or sheet rows.
