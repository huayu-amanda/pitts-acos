# acos-jstracing

In this repository, `acos-jstracing` is an **ACOS content-type module** consumed by `acos-server`.

## Development Conventions (Type-centered Layout)

- Content type runtime and frontend source: `acos-jstracing-type/`
- Content packages: `acos-jstracing-python/`, `acos-jstracing-java/`

Runtime assets are now centralized under:

- `acos-jstracing-type/static/body.html`
- `acos-jstracing-type/static/css/jstracing.css`
- `acos-jstracing-type/static/js/jstracing.js`
- `acos-jstracing-type/static/js/runtime-config.js`

Before packaging or startup, this project validates static asset presence:

```bash
npm run sync-static
```

## Runtime Mode

Standalone server scripts were removed. `npm run dev` and `npm run start` intentionally exit with an error and message:

```text
Standalone server has been removed. Start the host ACOS server instead.
```

Run through `acos-server` (typically via `deploy/ec2/docker-compose.yml`) and open pages under:

- `http://localhost:3000/html/jstracing/jstracing-python/<exercise>`
- `http://localhost:3000/html/jstracing/jstracing-java/<exercise>`

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

Route scheme used by `acos-server`:
- 页面：`/html/jstracing/:contentPackage/:name`
- 事件：`POST /html/jstracing/:contentPackage/:name/event`

CheerpJ runtime is remote-first by default. Configure `CHEERPJ_RUNTIME_BASE_URL` to set runtime source.
Optional local self-host fallback is controlled by `CHEERPJ_DISABLE_SELF_HOST` (`true` by default).
