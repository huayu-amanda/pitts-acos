"use strict";

const path = require("path");
const fs = require("fs");
const JSParsons = require("./jsparsons");

exports.packageType = "content-type";
exports.namespace = "jsparsons";

exports.register = function(handlers) {
  JSParsons.handlers = handlers;
  handlers.contentTypes.jsparsons = JSParsons;
  JSParsons.installedContentPackages = JSParsons.installedContentPackages || [];

  const pkgDir = path.join(__dirname, "..", "jsparsons-python");
  const manifestPath = path.join(pkgDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.warn("[acos-jsparsons] WARN: manifest.json not found in " + pkgDir);
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
    dir: pkgDir
  };

  (manifest.files || []).forEach((file) => {
    if (file.role === "exercise") {
      const name = file.name.replace(/\.json$/i, "");
      contentPackage.meta.contents[name] = {
        name,
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
  JSParsons.installedContentPackages.push(contentPackage);

  console.log("[acos-jsparsons] INFO: content type 'jsparsons' and content package '" + id + "' registered.");
};
