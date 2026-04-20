# acos-jstracing

In this repository, `acos-jstracing` is both an **ACOS content-type module** and a **standalone npm project** for convenient UI and Pyodide debugging.

## Development Conventions (Legacy-first Layout)

- UI source (this is where you mainly make changes): `lib/jstracing/frontend/`
- Static assets served to `acos-server`: `static/`

`acos-server` only maps the installed package's `static/` directory to `/static/jstracing`, so `static/` must exist.
To avoid maintaining duplicate files, this project automatically syncs before `npm run dev/start`:

```bash
npm run sync-static
```

This syncs `lib/jstracing/frontend/jstracing.(js|css)` to `static/`.

## Standalone Run (Without Docker)

From the `acos-jstracing/` directory:

```bash
npm install
npm run dev
```

- Default port: `3030` (override with environment variable `PORT`)
- Open: `http://localhost:3030/`
- Exercise page URL format is consistent with `acos-server`:
  - `http://localhost:3030/html/jstracing/jstracing-python/point_above_below`

After running, `<exercise>.session.json` is generated/updated under `jstracing-python/` (for example, `point_above_below.session.json`).

## Embed Into acos-server (As a Module)

`acos-server` maps the installed package's `static/` to: `/static/<package.namespace>`.

Frontend assets in this package:
- `static/jstracing.css`
- `static/jstracing.js`

Therefore, after embedding, the page loads assets from `/static/jstracing/...`.

### Recommended Local Development Switch Options (Flexible)

1) **Use npm link for hot switching** (easiest):

```bash
# In acos-jstracing/
npm link

# In acos-server/
npm link acos-jstracing
```

Then start `acos-server`; it will use your local `acos-jstracing` (refresh after changes).

2) **Pin with a file dependency to a local path** (more reproducible):

In `acos-server/package.json`, set the dependency as:

```json
{
  "dependencies": {
    "acos-jstracing": "file:../acos-jstracing"
  }
}
```

Then run:

```bash
npm install
```

Note: standalone-only dependencies for this package (for example, `express`) are in `devDependencies`.
So when installed as a dependency in `acos-server`, these development dependencies are not additionally installed; `acos-server` only uses the module logic under `lib/`.

## URL Compatibility

The standalone server and `acos-server` use the same route scheme:
- 页面：`/html/jstracing/:contentPackage/:name`
- 事件：`POST /html/jstracing/:contentPackage/:name/event`

This means UI behavior validated in standalone usually works in `acos-server` without frontend changes.
