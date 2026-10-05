# Clean-room AI Company Migration

## Scope

Migrate only the files listed by `PLATFORM_MANIFEST.json` and their explicitly
declared dependencies. Macro OS pages, ingestion adapters, credentials,
transcripts and project data are excluded.

## Required sequence

1. Generate and validate the platform manifest.
2. Copy `server/aiCompany` into a new package with its own `package.json`.
3. Replace relative imports crossing the boundary with package exports.
4. Run `npm run ai-company:gate` in the source workspace and the clean package.
5. Compare test counts and public exports; any unexplained loss blocks migration.
6. Add project adapters under `projects/`, never inside shared runtime modules.

## Non-negotiable evidence

- no secrets or project data in the copied package;
- all state paths are injectable and project-scoped;
- production config fails closed;
- release gate and decision gate remain active;
- test/typecheck/artifact/security gates pass in the clean workspace.

This document is a migration contract, not evidence that the separate package
has already been created.
