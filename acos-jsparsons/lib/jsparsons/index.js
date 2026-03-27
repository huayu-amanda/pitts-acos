"use strict";

const path = require("path");
const fs = require("fs");

const JSParsons = {
  namespace: "jsparsons",
  meta: {
    name: "jsparsons",
    title: "JS Parsons",
    description: "Parsons Problems for Python.",
    author: "",
    license: "ISC",
    version: "1.0.0",
    keywords: []
  },
  installedContentPackages: [],

  initialize: function(req, params, handlers, cb) {
    try {
      const contentPackageId = req.params.contentPackage;
      const exerciseName = req.params.name;
      const contentPackage = handlers.contentPackages[contentPackageId];

      if (!contentPackage) {
        console.error("[jsparsons] ERROR: Unknown content package:", contentPackageId);
        params.error = true;
        return cb();
      }

      const exerciseMeta = (contentPackage.meta.contents || {})[exerciseName];
      if (!exerciseMeta) {
        console.error("[jsparsons] ERROR: Unknown exercise:", exerciseName, "in package", contentPackageId);
        params.error = true;
        return cb();
      }

      const exercisePath = path.join(contentPackage.dir, exerciseMeta.file);
      if (!fs.existsSync(exercisePath)) {
        console.error("[jsparsons] ERROR: Exercise file not found:", exercisePath);
        params.error = true;
        return cb();
      }

      const exerciseData = JSON.parse(fs.readFileSync(exercisePath, "utf8"));
      const resolvedData = {
        name: req.query.name || exerciseData.name || exerciseName,
        description: req.query.description || exerciseData.description || "",
        instructions: req.query.instructions || exerciseData.instructions || "",
        initial: req.query.initial || exerciseData.initial || ""
      };

      // Choose protocol static namespace dynamically.
      // `splice` currently reuses html protocol event sender scripts.
      const protocolName = (req.params.protocol || "html").toLowerCase();
      const protocolStaticNs = protocolName === "lti"
        ? "lti"
        : (protocolName === "html" || protocolName === "splice" ? "html" : "html");

      const templatePath = path.join(__dirname, "frontend", "index.html");
      if (!fs.existsSync(templatePath)) {
        console.error("[jsparsons] ERROR: frontend index.html not found:", templatePath);
        params.error = true;
        return cb();
      }

      let html = fs.readFileSync(templatePath, "utf8");
      html = html.split("{{EXERCISE_JSON}}").join(JSON.stringify(resolvedData));
      html = html.split("{{META_JSON}}").join(JSON.stringify({
        protocol: req.params.protocol || "html",
        contentPackage: contentPackageId,
        exerciseName: exerciseName
      }));
      html = html.split("{{PROTOCOL_STATIC}}").join(protocolStaticNs);

      params.bodyContent = html;
      params.headContent = params.headContent || "";
      if (!/\/static\/jsparsons\/jsparsons\.css/.test(params.headContent)) {
        params.headContent += '<link rel="stylesheet" href="/static/jsparsons/jsparsons.css" />\n';
      }

      cb();
    } catch (err) {
      console.error("[jsparsons] ERROR in initialize:", err);
      params.error = true;
      cb();
    }
  },

  handleEvent: function(event, payload, req, res, protocolData, responseObj, next) {
    try {
      if (event === "grade") {
        responseObj.content = responseObj.content || {};
        responseObj.content.gradeReported = true;
      }
    } catch (err) {
      console.error("[jsparsons] ERROR in handleEvent:", err);
    }

    next(event, payload, req, res, protocolData, responseObj);
  }
};

module.exports = JSParsons;
