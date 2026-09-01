// runtime.js
"use strict";

const path = require("path");
const fs = require("fs");
const http = require('http');
const https = require('https');
const fetchQuizHelper = require('./fetch-quiz');

const getSessionFilePath = (contentPackageDir, exerciseName) =>
  path.join(contentPackageDir, `${exerciseName}.session.json`);

// Deprecated: kept for rollback/debugging reference only.
// Do not call this from content-type flow; ACOS server now owns protocol-level grade forwarding.
const legacyDirectForwardGradeToQuizPet = (req, payload, protocolData) => {
  const QUIZPET_BASE_URL = process.env.QUIZPET_BASE_URL || 'http://host.docker.internal:8080/quizpet';
  const targetUrl = QUIZPET_BASE_URL.replace(/\/$/, '') + '/api/acos/grade';

  const forwardPayload = {
    timestamp: new Date().toISOString(),
    acos: {
      protocol: req && req.params ? req.params.protocol : null,
      contentType: req && req.params ? req.params.contentType : null,
      contentPackage: req && req.params ? req.params.contentPackage : null,
      name: req && req.params ? req.params.name : null,
      ip: (req && (req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])))
        ? (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])
        : (req && req.ip ? req.ip : null),
      userAgent: req && req.headers ? (req.headers['user-agent'] || null) : null,
    },
    grade: payload || {},
    protocolData: protocolData || {},
  };

  const postJson = (urlStr, obj) => {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(urlStr);
        const lib = urlObj.protocol === 'https:' ? https : http;
        const body = JSON.stringify(obj);
        const opts = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + (urlObj.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Content-Length': Buffer.byteLength(body),
          },
        };
        const r = lib.request(opts, (resp) => {
          resp.on('data', () => {});
          resp.on('end', () => resolve({ statusCode: resp.statusCode }));
        });
        r.on('error', reject);
        r.write(body);
        r.end();
      } catch (e) {
        reject(e);
      }
    });
  };

  return postJson(targetUrl, forwardPayload)
    .then((r) => {
      if (!r || !(r.statusCode >= 200 && r.statusCode < 300)) {
        console.warn('[jstracing] WARN: legacy grade forward non-2xx', r && r.statusCode, 'target=', targetUrl);
      } else {
        console.info('[jstracing] INFO: legacy grade forwarded OK', 'target=', targetUrl);
      }
    })
    .catch((e) => {
      console.warn('[jstracing] WARN: legacy grade forward failed', 'target=', targetUrl, e && e.message ? e.message : e);
    });
};

/**
 * JSTracing content type object
 * Registered to handlers.contentTypes['jstracing'] by acos-jstracing/index.js
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

  // Filled by index.js:
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
      //    index.js sets contentPackage.dir to the directory of jstracing-python
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
      let sessionData = { code: "", answer: "", expectedResult: "", verdict: "", updatedAt: null };
      if (fs.existsSync(sessionPath)) {
        try {
          sessionData = JSON.parse(
            fs.readFileSync(sessionPath, "utf8")
          );

          // Backward compatibility: older sessions used { code, result }.
          if (sessionData && typeof sessionData === 'object') {
            if (typeof sessionData.expectedResult !== 'string' && typeof sessionData.result === 'string') {
              sessionData.expectedResult = sessionData.result;
            }
            if (typeof sessionData.verdict !== 'string') {
              sessionData.verdict = '';
            }
            if (typeof sessionData.answer !== 'string') {
              sessionData.answer = '';
            }
          }
        } catch (parseErr) {
          console.warn(
            "[jstracing] WARN: session json parse failed:",
            sessionPath,
            parseErr
          );
        }
      }

      // Always render from imported exercise code and fresh parameter instantiation.
      // Persisted session state must not override current exercise source.
      sessionData.code = "";
      sessionData.answer = "";
      sessionData.expectedResult = "";
      sessionData.verdict = "";

      // 3. Read the HTML body template. Prefer current layout and keep legacy fallback.
      const htmlPathCandidates = [
        path.join(__dirname, "static", "body.html"),
        path.join(__dirname, "..", "..", "static", "body.html")
      ];
      const htmlPath = htmlPathCandidates.find(function(candidate) {
        return fs.existsSync(candidate);
      });

      if (!htmlPath) {
        console.error("[jstracing] ERROR: body.html not found in candidates:", htmlPathCandidates);
        params.error = true;
        return cb();
      }

      let html = fs.readFileSync(htmlPath, "utf8");

      // 4. Use imported/static jstracing content as source code, then instantiate placeholders for student view.
      const exerciseJsonStringify = async () => {
        try {
          if (exerciseData && typeof exerciseData.code === 'string') {
            let quizMetaForRange = exerciseData;
            const quizId = (exerciseData && exerciseData.quizId) ? exerciseData.quizId : null;

            // Keep code source from imported jstracing JSON; fetch metadata only for MinVar/MaxVar range.
            if (quizId) {
              try {
                const QUIZPET_BASE_URL = process.env.QUIZPET_BASE_URL || "http://host.docker.internal:8080/quizpet";
                const fetched = await fetchQuizHelper.tryFetchQuizData(quizId, QUIZPET_BASE_URL);
                if (fetched && fetched.quizObj) {
                  quizMetaForRange = fetched.quizObj;
                }
              } catch (_metaErr) {
                // Ignore metadata fetch errors; instantiatePlaceholders has safe fallback range.
              }
            }

            const inst = fetchQuizHelper.instantiatePlaceholders(exerciseData.code, quizMetaForRange);
            if (inst && typeof inst.code === 'string') {
              exerciseData.code = inst.code;
            }
          }
        } catch (e) {
          console.warn('[jstracing] WARN: placeholder instantiation failed:', e && e.message ? e.message : e);
        }
        return JSON.stringify(exerciseData);
      };
      // Replace placeholders; note that exercise JSON may come from async fetch
      (async () => {
        try {
          const exerciseJson = await exerciseJsonStringify();
          // Replace all occurrences of placeholders (use split/join to replace globally)
          html = html.split("{{EXERCISE_JSON}}").join(exerciseJson);
          html = html.split("{{SESSION_JSON}}").join(JSON.stringify(sessionData));
          html = html.split("{{META_JSON}}").join(JSON.stringify({
            contentPackage: contentPackageId,
            exerciseName: exerciseName,
          }));

          // 5. Put the generated HTML into bodyContent for ACOS to render
          params.bodyContent = html;
          params.headContent = params.headContent || "";
          if (!/\/static\/jstracing\/css\/jstracing\.css/.test(params.headContent)) {
            params.headContent +=
              '<meta charset="utf-8" />\n<link rel="stylesheet" href="/static/jstracing/css/jstracing.css" />\n';
          }

          cb();
        } catch (err) {
          console.error('[jstracing] ERROR while preparing HTML:', err);
          params.error = true;
          cb();
        }
      })();
      return;
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
            answer: payload.answer || "",
            expectedResult: payload.expectedResult || payload.result || "",
            verdict: payload.verdict || "",
            // Backward compatible: keep `result` mirrored to expectedResult so older frontends still work.
            result: payload.expectedResult || payload.result || "",
            updatedAt: payload.updatedAt || new Date().toISOString(),
          };
          fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), "utf8");
          responseObj.content = responseObj.content || {};
          responseObj.content.saved = true;
        }
      } else if (event === 'grade') {
        // Grade forwarding now belongs to ACOS server's protocol-level dispatcher.
        // Keep old behavior available for debugging only, but do not call by default:
        // legacyDirectForwardGradeToQuizPet(req, payload, protocolData);
        responseObj.content = responseObj.content || {};
        responseObj.content.gradeReported = true;
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