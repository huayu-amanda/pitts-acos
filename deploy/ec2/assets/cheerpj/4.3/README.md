# CheerpJ 4.3 self-hosted assets

This directory is reserved for an optional self-hosted CheerpJ 4.3 distribution.
CheerpJ runtime files are not bundled in this repository.

By default, JSTracing loads CheerpJ from the official versioned CDN:

`https://cjrtnc.leaningtech.com/4.3/`

To use self-hosted assets:

1. Place the licensed CheerpJ 4.3 runtime files in this directory, including `loader.js`.
2. Set `CHEERPJ_RUNTIME_BASE_URL=/static/cheerpj/4.3/` for the `acos-server` container.
3. Keep `CHEERPJ_SELF_HOST_DIR=/usr/src/app/deploy-assets/cheerpj/4.3` unless the Docker asset location changes.
