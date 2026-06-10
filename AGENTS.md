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
- Public backend functions called from the frontend include `getDispatchAppData`, `getDispatchFairnessStats`, `saveWorkHourDispatch`, `saveWorkHourDispatchBatch`, `savePendingWorkHourDispatch`, `assignPendingWorkHourDispatch`, `deleteWorkHourDispatch`, `createStation`, and `deleteStation`.
- Holiday maintenance functions include `authorizeOfficialHolidayCalendar`, `refreshOfficialHolidayCalendarCache`, `installOfficialHolidayRefreshTrigger`, and `removeOfficialHolidayRefreshTrigger`. These depend on `UrlFetchApp`, `ScriptApp`, `CacheService`, and `PropertiesService` scopes in `appsscript.json`.
- Dispatch mutations must keep `LockService` protection, record version checks, overlap checks, temporary dispatch cooldown checks, and audit log writes intact.
- Saved dispatch records and audit logs are stored in hidden annual sheets such as `調派紀錄_2026` and `調派操作紀錄_2026`. Legacy Script Properties chunks are migrated into those annual sheets on first read. Keep `APP_CONFIG.maxDispatchRecordsPerYear` and `APP_CONFIG.maxDispatchAuditLogsPerYear` in mind when changing record shape.
- Source data is read with alias-based header lookup. If you add source columns or rename existing columns, update `FIELD_ALIASES` and any writer logic such as `appendStationRecord_`, `ensureStationManagerAssignment_`, and `syncTemporaryDispatchColumn_`.
- Preserve response shapes used by `index.html`: frontend code expects `success`, `message`, `viewer`, `stations`, `nurses`, `records`, `scheduleRecords`, `currentRecords`, `holidays`, `holidaySource`, `filters`, `shiftOptions`, and `managerCandidates` from `getDispatchAppData`.

## Data & Permission Model
- The active user comes from `Session.getActiveUser().getEmail()`. Empty email should remain a hard failure for data loading and mutations.
- Station manager permissions are derived from assignments and station relationships. Do not rely on frontend controls for authorization; backend assertions such as `assertCanManageStation_`, `assertCanAdministrateStation_`, and `assertCanCreateStation_` must remain authoritative.
- The app blocks unavailable personnel statuses such as 育嬰 and 留停 through `APP_CONFIG.unavailableStatusKeywords`.
- Station creation/deletion writes `組織架構樹` and station manager assignment rows in formal mode, but uses test-only stored overrides in test mode.
- Official holiday data is loaded from the government CSV, cached per year, and refreshed by a daily trigger around `APP_CONFIG.holidayRefreshHour`.

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
