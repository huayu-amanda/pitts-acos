// lib/jstracing/index.js
"use strict";

const path = require("path");
const fs = require("fs");

const getSessionFilePath = (contentPackageDir, exerciseName) =>
  path.join(contentPackageDir, `${exerciseName}.session.json`);

/**
 * JSTracing content type object
 * Registered to handlers.contentTypes['jstracing'] by acos-jstracing/lib/index.js
 */
const JSTracing = {
  namespace: "jstracing",        // ★ New
  // Metadata: appears on API / homepage
  meta: {
    name: "jstracing",
    title: "JSTracing",
    description: "Tracing exercises for Python (JSTracing visualization).",
    author: "",
    license: "ISC",
    version: "1.0.0",
    keywords: [],
  },

  // Filled by lib/index.js:
  // installedContentPackages: [ { meta, dir, ... }, ... ]
  installedContentPackages: [],

  /**
   * initialize(req, params, handlers, cb)
   *
   * ACOS calls this when rendering a content page:
   *  - req.params.contentType  -> "jstracing"
   *  - req.params.contentPackage -> "jstracing-python"
   *  - req.params.name -> exercise name (e.g. "point_above_below")
   *
   * What we need to do:
   *  1. Find the corresponding contentPackage and exercise description;
   *  2. Read the exercise JSON file;
   *  3. Read the frontend HTML template;
   *  4. Insert the JSON into the template, then put it into params.bodyContent;
   *  5. Call cb().
   */
  initialize: function (req, params, handlers, cb) {
    try {
      const contentPackageId = req.params.contentPackage; // jstracing-python
      const exerciseName = req.params.name; // point_above_below

      // 1. Get the content package object
      const contentPackage = handlers.contentPackages[contentPackageId];
      if (!contentPackage) {
        console.error(
          "[jstracing] ERROR: Unknown content package:",
          contentPackageId
        );
        params.error = true;
        return cb();
      }

      const contents = contentPackage.meta.contents || {};
      const exerciseMeta = contents[exerciseName];

      if (!exerciseMeta) {
        console.error(
          "[jstracing] ERROR: Unknown exercise:",
          exerciseName,
          "in package",
          contentPackageId
        );
        params.error = true;
        return cb();
      }

      // 2. Read the exercise JSON file
      //    lib/index.js sets contentPackage.dir to the directory of jstracing-python
      const exercisePath = path.join(contentPackage.dir, exerciseMeta.file);
      if (!fs.existsSync(exercisePath)) {
        console.error(
          "[jstracing] ERROR: Exercise file not found:",
          exercisePath
        );
        params.error = true;
        return cb();
      }

      const exerciseData = JSON.parse(
        fs.readFileSync(exercisePath, "utf8")
      );

      // 2.5 Read the exercise's session JSON (saving code and results)
      const sessionPath = getSessionFilePath(contentPackage.dir, exerciseName);
      let sessionData = { code: "", result: "", updatedAt: null };
      if (fs.existsSync(sessionPath)) {
        try {
          sessionData = JSON.parse(
            fs.readFileSync(sessionPath, "utf8")
          );
        } catch (parseErr) {
          console.warn(
            "[jstracing] WARN: session json parse failed:",
            sessionPath,
            parseErr
          );
        }
      }

      // 3. Read the frontend HTML template
      //    Assumed to be at jstracing/frontend/index.html
      const frontendDir = path.join(__dirname, "frontend");
      const htmlPath = path.join(frontendDir, "index.html");

      if (!fs.existsSync(htmlPath)) {
        console.error(
          "[jstracing] ERROR: frontend index.html not found:",
          htmlPath
        );
        params.error = true;
        return cb();
      }

      let html = fs.readFileSync(htmlPath, "utf8");

      // 4. Insert the JSON into the template
      //    The template should have a {{EXERCISE_JSON}} placeholder
      html = html.replace(
        "{{EXERCISE_JSON}}",
        JSON.stringify(exerciseData)
      );
      html = html.replace(
        "{{SESSION_JSON}}",
        JSON.stringify(sessionData)
      );
      html = html.replace(
        "{{META_JSON}}",
        JSON.stringify({
          contentPackage: contentPackageId,
          exerciseName: exerciseName,
        })
      );

      // 5. Put the generated HTML into bodyContent for ACOS to render
      params.bodyContent = html;
      params.headContent = params.headContent || "";
      if (!/\/static\/jstracing\/jstracing\.css/.test(params.headContent)) {
        params.headContent +=
          '<meta charset="utf-8" />\n<link rel="stylesheet" href="/static/jstracing/jstracing.css" />\n';
      }

      cb();
    } catch (err) {
      console.error("[jstracing] ERROR in initialize:", err);
      params.error = true;
      cb();
    }
  },

  /**
   * handleEvent(event, payload, req, res, protocolData, next)
   *
   * If you need to handle interactive events from the frontend in the future (e.g., logging, hints, etc.),
   * you can implement it here. For now, we simply continue by calling next().
   */
  handleEvent: function (event, payload, req, res, protocolData, responseObj, next) {
    try {
      if (event === "saveSession") {
        const contentPackageId = req.params.contentPackage;
        const exerciseName = req.params.name;
        const resolvedPackage = JSTracing.handlers && JSTracing.handlers.contentPackages
          ? JSTracing.handlers.contentPackages[contentPackageId]
          : null;

        if (resolvedPackage && exerciseName && payload) {
          const sessionPath = getSessionFilePath(resolvedPackage.dir, exerciseName);
          const sessionData = {
            code: payload.code || "",
            result: payload.result || "",
            updatedAt: payload.updatedAt || new Date().toISOString(),
          };
          fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), "utf8");
          responseObj.content = responseObj.content || {};
          responseObj.content.saved = true;
        }
      }
    } catch (err) {
      console.error("[jstracing] ERROR in handleEvent:", err);
      responseObj.content = responseObj.content || {};
      responseObj.content.saved = false;
    }

    next(event, payload, req, res, protocolData, responseObj);
  },
};

module.exports = JSTracing;