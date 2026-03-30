"use strict";

const path = require("path");
const fs = require("fs");

// Import content type object (./jstracing/index.js)
const JSTracing = require("./jstracing");

/**
 * These two lines are for acos-server/app.js auto-discovery:
 *   var pkg = require('acos-jstracing');
 *   if (pkg.packageType) { ... }
 */
exports.packageType = "content-type";
exports.namespace = "jstracing";

exports.register = function (handlers, app, config) {
  // Save handlers for content type handleEvent usage
  JSTracing.handlers = handlers;
  // 1. Register content type: name "jstracing"
  //    Make it appear in the homepage's Installed content types
  handlers.contentTypes["jstracing"] = JSTracing;

  // Ensure there is an installedContentPackages array
  JSTracing.installedContentPackages =
    JSTracing.installedContentPackages || [];

  const packageDirs = ["jstracing-python", "jstracing-java"];

  packageDirs.forEach((packageDirName) => {
    const pkgDir = path.join(__dirname, "..", packageDirName);
    const manifestPath = path.join(pkgDir, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      console.warn("[acos-jstracing] WARN: manifest.json not found in " + pkgDir);
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const contentPackage = {
      meta: {
        name: manifest.id,
        title: manifest.title,
        description: manifest.description,
        type: manifest.type,
        keywords: manifest.keywords || [],
        contents: {},
      },
      dir: pkgDir,
    };

    (manifest.files || []).forEach((file) => {
      if (file.role === "exercise") {
        const name = file.name.replace(/\.json$/i, "");
        contentPackage.meta.contents[name] = {
          name,
          file: file.name,
          role: file.role,
        };
      }
    });

    const id = contentPackage.meta.name;
    const type = contentPackage.meta.type;

    contentPackage.name = id;
    contentPackage.package = id;
    contentPackage.id = id;
    contentPackage.namespace = id;
    contentPackage.type = type;
    contentPackage.contentType = type;
    contentPackage.contentTypeNamespace = type;
    contentPackage.contents = contentPackage.meta.contents;
    contentPackage.title = contentPackage.meta.title;
    contentPackage.description = contentPackage.meta.description;

    handlers.contentPackages[contentPackage.meta.name] = contentPackage;
    JSTracing.installedContentPackages.push(contentPackage);

    console.log(
      "[acos-jstracing] INFO: content type 'jstracing' and content package '" +
        contentPackage.meta.name +
        "' registered."
    );
  });
};