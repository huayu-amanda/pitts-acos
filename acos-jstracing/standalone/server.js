"use strict";

const path = require("path");
const express = require("express");

const acosJstracing = require("../lib/index.js");

const createHandlers = () => ({
  protocols: {},
  contentTypes: {},
  contentPackages: {},
  tools: {},
  loggers: {},
  libraries: {},
});

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderLayout = (params) => {
  const title = escapeHtml(params.name || "jstracing");
  const head = params.headContent || "";
  const body = params.bodyContent || "";
  return `<!DOCTYPE html><html><head><title>${title}</title>${head}</head><body>${body}</body></html>`;
};

const coerceJson = (maybeJson, fallback) => {
  if (maybeJson == null) return fallback;
  if (typeof maybeJson === "object") return maybeJson;
  if (typeof maybeJson !== "string") return fallback;
  if (!maybeJson.trim()) return fallback;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return fallback;
  }
};

const main = () => {
  const app = express();
  const handlers = createHandlers();

  app.use(express.json({ limit: "2mb" }));

  // Register the content type + bundled content package (jstracing-python)
  acosJstracing.register(handlers, app, { autoDiscovery: false });

  // Serve package static assets the same way acos-server does
  app.use("/static/jstracing", express.static(path.join(__dirname, "..", "static")));

  const urlPrefix = "/html/:contentType(jstracing)/:contentPackage([a-zA-Z0-9_-]+)/:name([a-zA-Z0-9_-]+)";

  app.get("/", (req, res) => {
    const packages = Object.keys(handlers.contentPackages).sort();
    const links = [];

    for (const pkgName of packages) {
      const pkg = handlers.contentPackages[pkgName];
      const contents = (pkg && pkg.meta && pkg.meta.contents) || {};
      for (const exName of Object.keys(contents)) {
        links.push({
          href: `/html/jstracing/${encodeURIComponent(pkgName)}/${encodeURIComponent(exName)}`,
          text: `${pkgName} / ${exName}`,
        });
      }
    }

    const body = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;">
        <h1>acos-jstracing (standalone)</h1>
        <p>Open an exercise:</p>
        <ul>
          ${links
            .map((l) => `<li><a href="${l.href}">${escapeHtml(l.text)}</a></li>`)
            .join("\n")}
        </ul>
      </div>
    `;

    res.type("html").send(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>acos-jstracing</title></head><body>${body}</body></html>`);
  });

  app.get(urlPrefix, (req, res) => {
    const params = {
      name: req.params.name || "",
      headContent: "",
      bodyContent: "",
    };

    const ct = handlers.contentTypes.jstracing;
    if (!ct || !ct.initialize) {
      return res.status(500).send("jstracing content type not registered");
    }

    ct.initialize(req, params, handlers, () => {
      if (params.error) {
        return res.status(404).send("Initialization failed");
      }
      res.type("html").send(renderLayout(params));
    });
  });

  app.post(urlPrefix + "/event", (req, res) => {
    const ct = handlers.contentTypes.jstracing;
    if (!ct) {
      return res.status(500).json({ error: "jstracing content type not registered" });
    }

    const event = req.body && req.body.event;
    const payload = coerceJson(req.body && req.body.payload, {});
    const protocolData = coerceJson(req.body && req.body.protocolData, {});

    const responseObj = { protocol: {}, content: {} };

    if (typeof ct.handleEvent !== "function") {
      return res.json(responseObj);
    }

    ct.handleEvent(event, payload, req, res, protocolData, responseObj, () => {
      res.json(responseObj);
    });
  });

  const port = Number(process.env.PORT) || 3030;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[acos-jstracing] standalone running on http://localhost:${port}/`);
  });
};

main();
