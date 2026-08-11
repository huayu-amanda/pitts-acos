"use strict";

const fs = require("fs");
const path = require("path");

exports.packageType = "content";
exports.namespace = "jstracing-python";
exports.contentTypeNamespace = "jstracing";

exports.register = function registerPythonPackage(handlers) {
  const pkgDir = __dirname;
  const manifestPath = path.join(pkgDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.warn("[acos-jstracing-python] WARN: manifest.json not found in " + pkgDir);
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
      contents: {}
    },
    dir: path.join(pkgDir, "exercises")
  };

  (manifest.files || []).forEach(function(file) {
    if (file.role === "exercise") {
      const name = file.name.replace(/\.json$/i, "");
      contentPackage.meta.contents[name] = {
        name: name,
        file: file.name,
        role: file.role
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

  handlers.contentPackages[id] = contentPackage;
  if (handlers.contentTypes.jstracing && Array.isArray(handlers.contentTypes.jstracing.installedContentPackages)) {
    handlers.contentTypes.jstracing.installedContentPackages.push(contentPackage);
  }

  console.log("[acos-jstracing-python] INFO: registered content package '" + id + "'.");
};
