# Refactor Migration Checklist (version-3.2)

This document records the structural refactor performed on branch `version-3.2`.

## Goal

Restructure the codebase according to ACOS package roles:
- `content-type`: `jstracing`
- `content`: `jstracing-python`, `jstracing-java`
- `tool`: `quizpet-generator`

## New Structure Added

- `acos-jstracing/packages/acos-jstracing-type/`
- `acos-jstracing/packages/acos-jstracing-python/`
- `acos-jstracing/packages/acos-jstracing-java/`
- `acos-quizpet-generator-tool/`

## File-Level Migration Details

### 1) New content-type package

Added:
- `acos-jstracing/packages/acos-jstracing-type/index.js`
- `acos-jstracing/packages/acos-jstracing-type/package.json`
- `acos-jstracing/packages/acos-jstracing-type/lib/jstracing/index.js`
- `acos-jstracing/packages/acos-jstracing-type/lib/jstracing/fetch_quiz.js`
- `acos-jstracing/packages/acos-jstracing-type/lib/jstracing/frontend/*`
- `acos-jstracing/packages/acos-jstracing-type/static/*`

Behavior:
- Registers `handlers.contentTypes.jstracing`
- Keeps CheerpJ `/app` static mount and `/tools.jar` route

### 2) New content-package modules

Added Python package:
- `acos-jstracing/packages/acos-jstracing-python/index.js`
- `acos-jstracing/packages/acos-jstracing-python/package.json`
- `acos-jstracing/packages/acos-jstracing-python/manifest.json`
- `acos-jstracing/packages/acos-jstracing-python/exercises/*.json`

Added Java package:
- `acos-jstracing/packages/acos-jstracing-java/index.js`
- `acos-jstracing/packages/acos-jstracing-java/package.json`
- `acos-jstracing/packages/acos-jstracing-java/manifest.json`
- `acos-jstracing/packages/acos-jstracing-java/exercises/*.json`

Behavior:
- Each package loads its own `manifest.json`
- Each package registers itself into `handlers.contentPackages`
- Each package pushes itself into `handlers.contentTypes.jstracing.installedContentPackages`

### 3) Root jstracing entrypoint turned into orchestrator

Updated:
- `acos-jstracing/lib/index.js`

Before:
- Single file performed all content-type + content-package registration

After:
- Delegates to:
  - `packages/acos-jstracing-type`
  - `packages/acos-jstracing-python`
  - `packages/acos-jstracing-java`

### 4) jstracing package manifest includes new subtree

Updated:
- `acos-jstracing/package.json`

Change:
- Added `packages/` to `files` list

### 5) New standalone tool package

Added:
- `acos-quizpet-generator-tool/index.js`
- `acos-quizpet-generator-tool/package.json`
- `acos-quizpet-generator-tool/routes/quizpet-generator.js`
- `acos-quizpet-generator-tool/services/quizpet-generator-service.js`
- `acos-quizpet-generator-tool/services/quizpet-topic-options.js`
- `acos-quizpet-generator-tool/views/quizpet-generator.html`

Behavior:
- Exposes `packageType: tool`
- Registers `handlers.tools.quizpet-generator`
- Mounts generator routes via `registerQuizpetGeneratorRoutes(app, handlers)`

### 6) Tool route path resolution updated for new layout

Updated:
- `acos-quizpet-generator-tool/routes/quizpet-generator.js`

Change:
- `fetch_quiz` resolution now checks:
  1. `acos-jstracing/packages/acos-jstracing-type/lib/jstracing/fetch_quiz`
  2. legacy `acos-jstracing/lib/jstracing/fetch_quiz`
  3. node_modules fallback
- content package dir resolution now checks:
  1. `acos-jstracing/packages/acos-<packageId>`
  2. legacy locations

### 7) ACOS server decoupled from direct generator wiring

Updated:
- `acos-server/app.js`

Removed:
- direct `require('./routes/quizpet-generator')`
- direct `registerQuizpetGeneratorRoutes(app, handlers)` call
- front-page fallback injection for `quizpet-generator`

Kept compatibility guard:
- urlPrefix skip now includes both `quizpet-generator` and `quizpet-generator-pitts`

### 8) Docker install updated for tool package

Updated:
- `acos-server/Dockerfile`

Added:
- copy/install `./acos-quizpet-generator-tool`

## Operational Notes

- Existing URLs remain unchanged:
  - `/quizpet-generator`
  - `/quizpet-generator-pitts`
  - `/html/jstracing/jstracing-python/...`
  - `/html/jstracing/jstracing-java/...`

- This refactor focuses on package responsibilities and registration boundaries.
- Legacy source directories are kept to reduce migration risk and keep fallback resolution paths available.
