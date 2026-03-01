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

  // 2. Read and register the content package in this package: jstracing-python
  //    Directory: <package root>/jstracing-python/manifest.json
  const pkgDir = path.join(__dirname, "..", "jstracing-python");
  const manifestPath = path.join(pkgDir, "manifest.json");

  // If manifest.json does not exist, return early (avoid startup errors)
  if (!fs.existsSync(manifestPath)) {
    console.warn(
      "[acos-jstracing] WARN: manifest.json not found in " + pkgDir
    );
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  // Construct the content package object required by ACOS
  const contentPackage = {
    // Metadata
    meta: {
      name: manifest.id, // "jstracing-python"
      title: manifest.title,
      description: manifest.description,
      type: manifest.type, // "jstracing"
      keywords: manifest.keywords || [],
      contents: {}, // Will be filled based on manifest.files
    },

    // Custom field: to help content type know where the package directory is
    dir: pkgDir,
  };

  // Construct contents list based on manifest.files
  //
  // Your manifest.json:
  // {
  //   "id": "jstracing-python",
  //   "title": "JSTracing Python examples",
  //   "description": "Tracing exercises for Python.",
  //   "type": "jstracing",
  //   "files": [
  //     { "name": "point_above_below.json", "role": "exercise" }
  //   ]
  // }
  //
  // We will convert it to:
  // contents: {
  //   "point_above_below": {
  //     name: "point_above_below",
  //     file: "point_above_below.json",
  //     role: "exercise"
  //   }
  // }
  (manifest.files || []).forEach((file) => {
    if (file.role === "exercise") {
      // Remove .json suffix to get exercise name
      const name = file.name.replace(/\.json$/i, "");
      contentPackage.meta.contents[name] = {
        name,
        file: file.name,
        role: file.role,
      };
    }
  });

  const id = contentPackage.meta.name;   // "jstracing-python"
  const type = contentPackage.meta.type; // "jstracing"

  // Various names for the package itself
  contentPackage.name = id;
  contentPackage.package = id;
  contentPackage.id = id;
  contentPackage.namespace = id;             // ★ Key: For use in index.html

  // Content type related
  contentPackage.type = type;
  contentPackage.contentType = type;
  contentPackage.contentTypeNamespace = type; // ★ Key: For use in index.html

  // Other display metadata
  contentPackage.contents = contentPackage.meta.contents;
  contentPackage.title = contentPackage.meta.title;
  contentPackage.description = contentPackage.meta.description;

  console.log("[acos-jstracing] DEBUG contentPackage:",
    JSON.stringify(contentPackage, null, 2));

  // 3. Attach the content package to handlers
  //    This makes it appear in the homepage's Installed content packages
  handlers.contentPackages[contentPackage.meta.name] = contentPackage;

  // 4. Also attach it to the corresponding content type's installedContentPackages
  JSTracing.installedContentPackages.push(contentPackage);

  console.log(
    "[acos-jstracing] INFO: content type 'jstracing' and content package '" +
      contentPackage.meta.name +
      "' registered."
  );
};