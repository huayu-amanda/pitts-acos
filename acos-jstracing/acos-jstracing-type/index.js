"use strict";

const path = require("path");
const fs = require("fs");
const JSTracing = require("./runtime");

exports.packageType = "content-type";
exports.namespace = "jstracing";
exports.register = function registerJSTracingType(handlers, app, config) {
  const configuredToolsJarPath = process.env.JSTRACING_TOOLS_JAR_PATH ||
    (config && config.jstracingToolsJarPath) || "";
  const toolsJarPath = String(configuredToolsJarPath).trim();
  const resolvedToolsJarPath = toolsJarPath ? path.resolve(toolsJarPath) : "";
  const toolsJarExists = Boolean(resolvedToolsJarPath) &&
    fs.existsSync(resolvedToolsJarPath) &&
    fs.statSync(resolvedToolsJarPath).isFile();

  // CheerpJ maps virtual /app/tools.jar to the HTTP /tools.jar endpoint.
  if (app && typeof app.get === "function" && toolsJarExists) {
    app.get("/tools.jar", function(req, res) {
      res.sendFile(resolvedToolsJarPath);
    });
    console.log("[acos-jstracing-type] INFO: serving /tools.jar from", resolvedToolsJarPath);
  } else if (toolsJarPath) {
    console.warn("[acos-jstracing-type] WARN: configured tools.jar was not found or is not a file at", resolvedToolsJarPath);
  } else {
    console.warn("[acos-jstracing-type] WARN: JSTRACING_TOOLS_JAR_PATH is not configured; Java compilation is unavailable.");
  }

  // Prefer remote CheerpJ runtime by default.
  // Set CHEERPJ_DISABLE_SELF_HOST=false to enable local self-host fallback explicitly.
  const disableSelfHostRaw = String(process.env.CHEERPJ_DISABLE_SELF_HOST || "true").trim().toLowerCase();
  const selfHostDisabled = disableSelfHostRaw === "1" ||
    disableSelfHostRaw === "true" ||
    disableSelfHostRaw === "yes" ||
    disableSelfHostRaw === "on";

  const cheerpjSelfHostDir = process.env.CHEERPJ_SELF_HOST_DIR ||
    (config && config.cheerpjSelfHostDir);
  if (!selfHostDisabled && app && typeof app.get === "function" && cheerpjSelfHostDir && fs.existsSync(cheerpjSelfHostDir)) {
    const selfHostRoot = path.resolve(cheerpjSelfHostDir);
    app.get("/static/cheerpj/4.3/*", function(req, res, next) {
      const requestedPath = path.resolve(selfHostRoot, req.params[0] || "");
      if (requestedPath !== selfHostRoot && requestedPath.indexOf(selfHostRoot + path.sep) !== 0) {
        return res.sendStatus(403);
      }
      fs.stat(requestedPath, function(err, stat) {
        if (err || !stat.isFile()) {
          return next();
        }
        return res.sendFile(requestedPath);
      });
    });
    console.log("[acos-jstracing-type] INFO: self-hosted CheerpJ fallback directory is", selfHostRoot);
  } else if (!selfHostDisabled && cheerpjSelfHostDir) {
    console.warn("[acos-jstracing-type] WARN: CHEERPJ_SELF_HOST_DIR not found, keep using remote runtime:", cheerpjSelfHostDir);
  }

  JSTracing.handlers = handlers;
  JSTracing.installedContentPackages = JSTracing.installedContentPackages || [];
  handlers.contentTypes.jstracing = JSTracing;
};
