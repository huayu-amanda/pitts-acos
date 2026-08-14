"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const JSTracing = require("./runtime");

exports.packageType = "content-type";
exports.namespace = "jstracing";

exports.register = function registerJSTracingType(handlers, app) {
  const bundledAppStaticDir = path.join(__dirname, "..", "..", "..", "app");
  const workspaceJavaFiddleStaticDir = path.join(__dirname, "..", "..", "..", "..", "javafiddle-main", "static");
  const appStaticDir = fs.existsSync(bundledAppStaticDir)
    ? bundledAppStaticDir
    : workspaceJavaFiddleStaticDir;
  const toolsJarPath = path.join(appStaticDir, "tools.jar");

  if (app && typeof app.use === "function" && fs.existsSync(appStaticDir)) {
    app.use("/app", express.static(appStaticDir));
    console.log("[acos-jstracing-type] INFO: serving CheerpJ app assets from", appStaticDir);
  }

  if (app && typeof app.get === "function" && fs.existsSync(toolsJarPath)) {
    app.get("/tools.jar", function(req, res) {
      res.sendFile(toolsJarPath);
    });
    console.log("[acos-jstracing-type] INFO: serving tools.jar from", toolsJarPath);
  }

  JSTracing.handlers = handlers;
  JSTracing.installedContentPackages = JSTracing.installedContentPackages || [];
  handlers.contentTypes.jstracing = JSTracing;
};
