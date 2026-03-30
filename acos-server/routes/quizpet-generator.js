"use strict";

var express = require('express');
var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');
var createQuizpetGeneratorService = require('../services/quizpet-generator-service');

var tryFetchQuizCode = null;
var getLastFetchQuizDiagnostic = null;
try {
  var fetchQuizModuleLocal = require(path.join(__dirname, '..', '..', 'acos-jstracing', 'lib', 'jstracing', 'fetch_quiz'));
  tryFetchQuizCode = fetchQuizModuleLocal.tryFetchQuizCode;
  getLastFetchQuizDiagnostic = fetchQuizModuleLocal.getLastFetchQuizDiagnostic;
} catch (e1) {
  try {
    var fetchQuizModuleNodeModules = require(path.join(__dirname, '..', 'node_modules', 'acos-jstracing', 'lib', 'jstracing', 'fetch_quiz'));
    tryFetchQuizCode = fetchQuizModuleNodeModules.tryFetchQuizCode;
    getLastFetchQuizDiagnostic = fetchQuizModuleNodeModules.getLastFetchQuizDiagnostic;
  } catch (e2) {
    tryFetchQuizCode = null;
    getLastFetchQuizDiagnostic = null;
  }
}

var slugifyExerciseName = function(raw, fallback) {
  var source = String(raw || '').trim();
  if (!source) {
    source = String(fallback || '').trim();
  }
  source = source.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return source || 'quizpet_exercise';
};

var cleanQuizTitle = function(raw, fallback) {
  var title = String(raw || '').replace(/\.\*/g, '').trim();
  if (!title) {
    title = String(fallback || '').replace(/\.\*/g, '').trim();
  }
  title = title
    .replace(/^q_(py|java)_/i, '')
    .replace(/^q_/i, '')
    .replace(/\.(py|java)$/i, '')
    .replace(/_+$/g, '')
    .trim();
  return title;
};

var extractCodeHeaderFileName = function(code) {
  var text = String(code || '').replace(/\r\n/g, '\n');
  var lines = text.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i] || '').trim();
    if (!line) {
      continue;
    }
    line = line.replace(/^#+\s*/, '');
    line = line.replace(/^\/\/+\s*/, '');
    line = line.replace(/^\/\*+\s*/, '').replace(/\*\/\s*$/, '');
    line = line.trim();
    if (/^[a-zA-Z0-9_.-]+\.(py|java)$/i.test(line)) {
      return line;
    }
    break;
  }

  return '';
};

var readJsonSafe = function(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
};

var writeJsonPretty = function(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
};

var normalizeSupportFiles = function(rawValue) {
  var input = rawValue;
  if (typeof input === 'string') {
    var trimmed = input.trim();
    if (!trimmed) {
      return [];
    }
    try {
      input = JSON.parse(trimmed);
    } catch (_e) {
      return [];
    }
  }

  if (!Array.isArray(input)) {
    return [];
  }

  var result = [];
  for (var i = 0; i < input.length; i++) {
    var item = input[i] || {};
    var name = String(item.name || '').trim();
    var content = String(item.content || '');

    if (!name || !content.trim()) {
      continue;
    }

    // Reject absolute and traversal paths; files are loaded into Pyodide root.
    if (name.indexOf('..') !== -1 || name[0] === '/' || name[0] === '\\') {
      continue;
    }

    result.push({
      name: name,
      content: content
    });
  }

  return result;
};

var resolveJSTracingPackageDir = function(packageId) {
  var pkg = String(packageId || 'jstracing-python').trim();
  var candidates = [
    path.join(__dirname, '..', 'node_modules', 'acos-jstracing', pkg),
    path.join(__dirname, '..', '..', 'acos-jstracing', pkg)
  ];

  for (var i = 0; i < candidates.length; i++) {
    var dir = candidates[i];
    var manifestPath = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return dir;
    }
  }
  return null;
};

var httpGetJson = function(urlStr) {
  return new Promise(function(resolve, reject) {
    try {
      var urlObj = new URL(urlStr);
      var lib = urlObj.protocol === 'https:' ? https : http;
      var req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      }, function(resp) {
        var data = '';
        resp.on('data', function(chunk) { data += chunk; });
        resp.on('end', function() {
          var statusCode = resp.statusCode || 0;
          var contentType = (resp.headers && resp.headers['content-type']) ? resp.headers['content-type'] : '';
          try {
            var parsed = JSON.parse(data);
            if (statusCode >= 400) {
              var statusErr = new Error('QuizPet returned HTTP ' + statusCode + ' with JSON response.');
              statusErr.statusCode = statusCode;
              statusErr.contentType = contentType || null;
              statusErr.responseBody = data;
              statusErr.responseBodySnippet = String(data || '').substring(0, 300);
              statusErr.responseJson = parsed;
              return reject(statusErr);
            }
            resolve(parsed);
          } catch (e) {
            var parseErr = new Error('Response is not valid JSON.');
            parseErr.statusCode = statusCode;
            parseErr.contentType = contentType || null;
            parseErr.responseBody = data;
            parseErr.responseBodySnippet = String(data || '').substring(0, 300);
            reject(parseErr);
          }
        });
      });
      req.on('error', reject);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
};

var getQuizPetBaseUrl = function() {
  var base = process.env.QUIZPET_BASE_URL || 'http://host.docker.internal:8080/quizpet';
  return base.replace(/\/$/, '');
};

var pickQuizFromServerMessage = function(payload) {
  if (!payload || !payload.content || !Array.isArray(payload.content) || payload.content.length === 0) {
    return null;
  }
  return payload.content[0] || null;
};

var registerExerciseInRuntime = function(handlers, packageId, exerciseName, fileName, exerciseTitle) {
  var contentPackage = handlers.contentPackages[packageId];
  if (!contentPackage) {
    return;
  }
  contentPackage.meta = contentPackage.meta || {};
  contentPackage.meta.contents = contentPackage.meta.contents || {};
  contentPackage.meta.contents[exerciseName] = {
    name: exerciseName,
    file: fileName,
    role: 'exercise',
    title: exerciseTitle || exerciseName
  };
};

var normalizeQuizList = function(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(function(item) {
    return {
      quizId: item.quizId,
      title: item.title || ('Quiz ' + item.quizId),
      rdfId: item.rdfId || '',
      topicId: item.topicId || null
    };
  }).filter(function(item) {
    return item.quizId !== undefined && item.quizId !== null;
  });
};

var cleanBaseUrl = function(url, fallback) {
  var chosen = String(url || '').trim() || fallback;
  return String(chosen || '').replace(/\/$/, '');
};

var resolveGeneratorSources = function() {
  var localBase = cleanBaseUrl(
    process.env.QUIZPET_BASE_URL_LOCAL || process.env.QUIZPET_BASE_URL,
    'http://host.docker.internal:8080/quizpet'
  );
  var pittsBase = cleanBaseUrl(
    process.env.QUIZPET_BASE_URL_PITTS,
    'https://adapt2.sis.pitt.edu/quizpet_authoring'
  );

  return {
    local: {
      key: 'local',
      label: 'Using local QuizPetAuthoring_Python',
      routeBase: '/quizpet-generator',
      contentPackage: 'jstracing-python',
      quizpetBaseUrl: localBase,
      username: process.env.QUIZPET_USERNAME_LOCAL || process.env.QUIZPET_USERNAME || '',
      password: process.env.QUIZPET_PASSWORD_LOCAL || process.env.QUIZPET_PASSWORD || ''
    },
    pitts: {
      key: 'pitts',
      label: 'Using adapt2-pitt QuizPetAuthoring_Java',
      routeBase: '/quizpet-generator-pitts',
      contentPackage: 'jstracing-java',
      quizpetBaseUrl: pittsBase,
      username: process.env.QUIZPET_USERNAME_PITTS || process.env.QUIZPET_USERNAME || '',
      password: process.env.QUIZPET_PASSWORD_PITTS || process.env.QUIZPET_PASSWORD || ''
    }
  };
};

var createQuizpetRouter = function(handlers, sourceConfig) {
  var router = express.Router();
  var sourceLanguage = sourceConfig.key === 'pitts' ? 'java' : 'python';
  var sourceContentPackage = sourceConfig.contentPackage || (sourceLanguage === 'java' ? 'jstracing-java' : 'jstracing-python');

  var getQuizPetBaseUrl = function() {
    return sourceConfig.quizpetBaseUrl;
  };

  var tryFetchQuizCodeWithSource = null;
  if (typeof tryFetchQuizCode === 'function') {
    tryFetchQuizCodeWithSource = function(quizId, baseUrl) {
      return tryFetchQuizCode(quizId, baseUrl, {
        username: sourceConfig.username,
        password: sourceConfig.password,
        loginMode: sourceConfig.key === 'pitts' ? 'cookie-username-password' : 'compat'
      });
    };
  }

  var quizpetGeneratorService = createQuizpetGeneratorService({
    httpGetJson: httpGetJson,
    getQuizPetBaseUrl: getQuizPetBaseUrl,
    pickQuizFromServerMessage: pickQuizFromServerMessage,
    tryFetchQuizCode: tryFetchQuizCodeWithSource,
    getFetchQuizDiagnostic: (typeof getLastFetchQuizDiagnostic === 'function') ? getLastFetchQuizDiagnostic : null
  });

  router.get('/', function(req, res) {
    res.render('quizpet-generator.html', {
      quizpetBaseUrl: getQuizPetBaseUrl(),
      routeBase: sourceConfig.routeBase,
      sourceLabel: sourceConfig.label,
      sourceKey: sourceConfig.key,
      sourceContentPackage: sourceContentPackage
    });
  });

  router.get('/api/topics', function(req, res) {
    res.json({
      success: true,
      topics: quizpetGeneratorService.getTopicOptions()
    });
  });

  router.get('/api/quizzes-by-topic/:topicId([0-9]+)', function(req, res) {
    var topicId = parseInt(req.params.topicId, 10);
    var allTopics = quizpetGeneratorService.getTopicOptions();
    var topic = null;

    for (var i = 0; i < allTopics.length; i++) {
      if (parseInt(allTopics[i].topicId, 10) === topicId) {
        topic = allTopics[i];
        break;
      }
    }

    if (!topic) {
      return res.json({ success: true, quizzes: [] });
    }

    var keywords = [];
    var key = String(topic.key || '').trim();
    var title = String(topic.title || '').trim();

    if (key) {
      keywords.push(key);
    }
    if (title) {
      keywords.push(title);
    }

    if (!keywords.length) {
      return res.json({ success: true, quizzes: [] });
    }

    var baseUrl = getQuizPetBaseUrl();
    var requests = keywords.map(function(keyword) {
      var searchUrl = baseUrl + '/quiz/search/' + encodeURIComponent(keyword);
      return httpGetJson(searchUrl)
        .then(normalizeQuizList)
        .catch(function() { return []; });
    });

    Promise.all(requests)
      .then(function(groups) {
        var merged = [];
        var seen = {};

        groups.forEach(function(group) {
          group.forEach(function(item) {
            var idKey = String(item.quizId);
            if (!seen[idKey]) {
              seen[idKey] = true;
              merged.push(item);
            }
          });
        });

        var filtered = merged.filter(function(item) {
          return parseInt(item.topicId, 10) === topicId;
        });

        var finalList = filtered.length ? filtered : merged;
        if (!finalList.length && Array.isArray(topic.sampleQuizzes)) {
          finalList = topic.sampleQuizzes.map(function(item) {
            return {
              quizId: item.quizId,
              title: item.title || ('Quiz ' + item.quizId),
              rdfId: '',
              topicId: topicId
            };
          });
        }

        var hiddenQuizIds = Array.isArray(topic.hiddenQuizIds)
          ? topic.hiddenQuizIds.map(function(id) { return parseInt(id, 10); })
          : [];

        if (hiddenQuizIds.length) {
          finalList = finalList.filter(function(item) {
            return hiddenQuizIds.indexOf(parseInt(item.quizId, 10)) === -1;
          });
        }

        finalList.sort(function(a, b) {
          return parseInt(a.quizId, 10) - parseInt(b.quizId, 10);
        });

        res.json({ success: true, quizzes: finalList });
      })
      .catch(function(error) {
        res.status(502).json({
          success: false,
          error: error && error.message ? error.message : 'Failed to load quizzes for topic.'
        });
      });
  });

  router.get('/api/quiz/:quizId([0-9]+)', function(req, res) {
    var quizId = parseInt(req.params.quizId, 10);
    quizpetGeneratorService.loadQuizById(quizId)
      .then(function(quiz) {
        if (!quiz || typeof quiz !== 'object') {
          quiz = {};
        }
        quiz.language = String(quiz.language || sourceLanguage).toLowerCase();
        quiz.contentPackage = sourceContentPackage;
        res.json({
          success: true,
          quiz: quiz
        });
      })
      .catch(function(error) {
        return res.status(502).json({
          success: false,
          error: error && error.message ? error.message : 'Failed to fetch quiz from QuizPet.'
        });
      });
  });

  router.get('/api/search', function(req, res) {
    var keyword = String(req.query.keyword || '').trim();
    if (!keyword) {
      return res.json({ success: true, quizzes: [] });
    }

    var baseUrl = getQuizPetBaseUrl();
    var searchUrl = baseUrl + '/quiz/search/' + encodeURIComponent(keyword);
    httpGetJson(searchUrl)
      .then(function(list) {
        var normalized = Array.isArray(list) ? list.map(function(item) {
          return {
            quizId: item.quizId,
            title: item.title || ('Quiz ' + item.quizId),
            rdfId: item.rdfId || '',
            topicId: item.topicId || null
          };
        }) : [];
        res.json({ success: true, quizzes: normalized });
      })
      .catch(function(error) {
        res.status(502).json({
          success: false,
          error: error && error.message ? error.message : 'Search failed.'
        });
      });
  });

  router.post('/api/import', function(req, res) {
    var requestedLanguage = String(req.body.language || sourceLanguage || 'python').trim().toLowerCase();
    var language = requestedLanguage === 'java' ? 'java' : 'python';
    var contentPackageId = language === 'java' ? 'jstracing-java' : 'jstracing-python';
    var packageDir = resolveJSTracingPackageDir(contentPackageId);
    if (!packageDir) {
      return res.status(500).json({
        success: false,
        error: 'Could not locate ' + contentPackageId + ' package directory.'
      });
    }

    var quizIdRaw = req.body.quizId;
    var quizId = (quizIdRaw === undefined || quizIdRaw === null || quizIdRaw === '') ? null : parseInt(quizIdRaw, 10);
    var topicIdRaw = req.body.topicId;
    var topicId = (topicIdRaw === undefined || topicIdRaw === null || topicIdRaw === '') ? null : parseInt(topicIdRaw, 10);
    var topicKey = String(req.body.topicKey || '').trim();
    var topicTitle = String(req.body.topicTitle || '').trim();
    var rdfId = String(req.body.rdfId || '').trim();
    var title = cleanQuizTitle(req.body.title, quizId ? ('quiz_' + quizId) : 'quizpet_exercise');
    var description = String(req.body.description || '').trim();
    var question = String(req.body.question || '').trim();
    var code = String(req.body.code || '');
    var supportFiles = normalizeSupportFiles(req.body.supportFiles);

    if (!code.trim()) {
      return res.status(400).json({ success: false, error: 'Code is required.' });
    }

    var preferredName = cleanQuizTitle(req.body.exerciseName, title);
    var exerciseName = slugifyExerciseName(preferredName, title || (quizId ? ('quiz_' + quizId) : 'quizpet_exercise'));
    if (contentPackageId === 'jstracing-java' && exerciseName === 'sample_quiz') {
      // Keep the built-in sample_quiz immutable; imported Java quizzes should use a distinct name.
      var uniqueSuffix = quizId ? String(quizId) : String(Date.now());
      exerciseName = 'sample_quiz_' + uniqueSuffix;
    }
    var fileName = exerciseName + '.json';
    var exercisePath = path.join(packageDir, fileName);
    var manifestPath = path.join(packageDir, 'manifest.json');

    var exercisePayload = {
      id: exerciseName,
      quizId: quizId,
      topicId: topicId,
      topicKey: topicKey,
      topicTitle: topicTitle,
      rdfId: rdfId,
      title: title || exerciseName,
      description: description,
      language: language,
      code: code,
      question: question || 'What is the output?'
    };

    var mainFileName = extractCodeHeaderFileName(code);
    if (mainFileName) {
      exercisePayload.mainFileName = mainFileName;
    }

    if (supportFiles.length) {
      exercisePayload.supportFiles = supportFiles;
    }

    try {
      writeJsonPretty(exercisePath, exercisePayload);

      var manifest = readJsonSafe(manifestPath, null);
      if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('manifest.json is missing or invalid.');
      }

      var alreadyExists = manifest.files.some(function(item) {
        return item && item.name === fileName;
      });

      if (!alreadyExists) {
        manifest.files.push({ name: fileName, role: 'exercise' });
        writeJsonPretty(manifestPath, manifest);
      }

      registerExerciseInRuntime(handlers, contentPackageId, exerciseName, fileName, title);

      return res.json({
        success: true,
        result: {
          contentType: 'jstracing',
          contentPackage: contentPackageId,
          exerciseName: exerciseName,
          exerciseFile: fileName,
          htmlUrl: '/html/jstracing/' + contentPackageId + '/' + exerciseName
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error && error.message ? error.message : 'Failed to import quiz.'
      });
    }
  });

  return router;
};

module.exports = function registerQuizpetGeneratorRoutes(app, handlers) {
  var sources = resolveGeneratorSources();
  var localRouter = createQuizpetRouter(handlers, sources.local);
  var pittsRouter = createQuizpetRouter(handlers, sources.pitts);

  app.use(sources.local.routeBase, localRouter);
  app.use(sources.pitts.routeBase, pittsRouter);
};