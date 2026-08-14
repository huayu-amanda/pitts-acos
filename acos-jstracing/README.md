# acos-jstracing

In this repository, `acos-jstracing` is both an **ACOS content-type module** and a **standalone npm project** for convenient UI and Pyodide debugging.

## Development Conventions (Type-centered Layout)

- Content type runtime and frontend source: `acos-jstracing-type/`
- Content packages: `acos-jstracing-python/`, `acos-jstracing-java/`

Runtime assets are now centralized under:

- `acos-jstracing-type/static/body.html`
- `acos-jstracing-type/static/css/jstracing.css`
- `acos-jstracing-type/static/js/jstracing.js`
- `acos-jstracing-type/static/js/runtime-config.js`

Before `npm run dev/start`, this project validates static asset presence:

```bash
npm run sync-static
```

## Standalone Run (Without Docker)

From the `acos-jstracing/` directory:

```bash
npm install
npm run dev
```

- Default port: `3030` (override with environment variable `PORT`)
- Open: `http://localhost:3030/`
- Exercise page URL format is consistent with `acos-server`:
  - `http://localhost:3030/html/jstracing/jstracing-python/sample_quiz`

After running, `<exercise>.session.json` is generated/updated under `acos-jstracing-python/` (for example, `sample_quiz.session.json`).

## Embed Into acos-server (As a Module)

`acos-server` maps package static files to `/static/<package.namespace>`.
For `acos-jstracing`, the mapping is explicitly kept as `/static/jstracing/...`.

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
