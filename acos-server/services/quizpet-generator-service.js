"use strict";

var quizpetTopicOptions = require('./quizpet-topic-options');

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

var cleanQuizTitle = function(rawTitle, fallback) {
  var title = String(rawTitle || '').replace(/\.\*/g, '').trim();
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

var resolveLanguageToken = function(rawValue) {
  var value = String(rawValue || '').trim().toLowerCase();
  if (!value) {
    return '';
  }

  if (value === 'java' || /^q_?java$/.test(value) || value.indexOf('java') !== -1) {
    return 'java';
  }

  if (
    value === 'python' ||
    value === 'py' ||
    /^q_?py(thon)?$/.test(value) ||
    value.indexOf('python') !== -1
  ) {
    return 'python';
  }

  return '';
};

var inferQuizLanguage = function(quiz, code, fallbackLanguage) {
  var q = quiz || {};
  var fallback = String(fallbackLanguage || 'python').trim().toLowerCase() === 'java' ? 'java' : 'python';

  var candidates = [q.domain, q.language, q.lang, q.quizDomain, q.rdfId, q.rdfIdDisplay];
  for (var i = 0; i < candidates.length; i++) {
    var resolved = resolveLanguageToken(candidates[i]);
    if (resolved) {
      return resolved;
    }
  }

  var headerFileName = extractCodeHeaderFileName(code);
  if (/\.java$/i.test(headerFileName)) {
    return 'java';
  }
  if (/\.py$/i.test(headerFileName)) {
    return 'python';
  }

  return fallback;
};

var normalizeLoadedQuizCode = function(code, language) {
  var source = String(code || '');
  if (language !== 'java') {
    return source;
  }

  // Keep Java main class name aligned with default Main.java execution flow.
  return source.replace(/public\s+class\s+Tester\b/g, 'public class Main');
};

var buildQuizResponse = function(quiz, quizId, code, fallbackLanguage) {
  var q = quiz || {};
  var rawCode = code || '';
  var language = inferQuizLanguage(q, rawCode, fallbackLanguage);
  var resolvedCode = normalizeLoadedQuizCode(rawCode, language);
  var codeHeaderFileName = extractCodeHeaderFileName(resolvedCode);
  var titleFallback = codeHeaderFileName || ('Quiz ' + quizId);
  var resolvedTitle = cleanQuizTitle(q.title, titleFallback);

  return {
    quizId: q.quizId || quizId,
    topicId: q.topicId || null,
    rdfId: q.rdfId || '',
    title: resolvedTitle || ('Quiz ' + quizId),
    description: q.decp || q.description || '',
    question: q.decp || q.question || q.description || '',
    code: resolvedCode,
    codeHeaderFileName: codeHeaderFileName || '',
    language: language,
    domain: language
  };
};

var createQuizpetGeneratorService = function(deps) {
  deps = deps || {};

  var httpGetJson = deps.httpGetJson;
  var getQuizPetBaseUrl = deps.getQuizPetBaseUrl;
  var pickQuizFromServerMessage = deps.pickQuizFromServerMessage;
  // var tryFetchQuizCode = deps.tryFetchQuizCode; // Disabled for now: login-first flow uses tryFetchQuizData only.
  var tryFetchQuizData = deps.tryFetchQuizData;
  var getFetchQuizDiagnostic = deps.getFetchQuizDiagnostic;
  var defaultLanguage = String(deps.defaultLanguage || 'python').trim().toLowerCase() === 'java' ? 'java' : 'python';

  if (typeof httpGetJson !== 'function') {
    throw new Error('quizpet-generator-service requires httpGetJson function.');
  }
  if (typeof getQuizPetBaseUrl !== 'function') {
    throw new Error('quizpet-generator-service requires getQuizPetBaseUrl function.');
  }
  if (typeof pickQuizFromServerMessage !== 'function') {
    throw new Error('quizpet-generator-service requires pickQuizFromServerMessage function.');
  }

  var loadQuizById = function(quizId) {
    var baseUrl = getQuizPetBaseUrl();
    if (typeof tryFetchQuizData !== 'function') {
      throw new Error('QuizPet authenticated fetch is not available in this deployment.');
    }

    return Promise.resolve(tryFetchQuizData(quizId, baseUrl))
      .then(function(fetchedQuizData) {
        var quiz = fetchedQuizData && fetchedQuizData.quizObj ? fetchedQuizData.quizObj : null;
        var code = fetchedQuizData && typeof fetchedQuizData.code === 'string'
          ? fetchedQuizData.code
          : (quiz && quiz.code ? quiz.code : '');

        if (!quiz && !code) {
          var fetchDiag = (typeof getFetchQuizDiagnostic === 'function') ? getFetchQuizDiagnostic() : null;

          if (fetchDiag && fetchDiag.kind === 'no-such-quiz-id') {
            throw new Error('QuizPet returned "No such quiz id." for quiz ID ' + quizId + '.');
          }
          if (fetchDiag && fetchDiag.statusCode === 500) {
            throw new Error('QuizPet returned HTTP 500 for quiz ID ' + quizId + ' (remote backend error).');
          }
          if (fetchDiag && fetchDiag.kind === 'non-json') {
            var ct = fetchDiag.contentType ? fetchDiag.contentType : 'unknown content-type';
            var sc = fetchDiag.statusCode ? fetchDiag.statusCode : 'unknown status';
            throw new Error('QuizPet returned non-JSON for quiz ID ' + quizId + ' (HTTP ' + sc + ', ' + ct + ').');
          }

          throw new Error('QuizPet did not return usable quiz data for quiz ID ' + quizId + '.');
        }

        return buildQuizResponse(quiz, quizId, code, defaultLanguage);
      });
  };

  var getTopicOptions = function() {
    return quizpetTopicOptions;
  };

  return {
    loadQuizById: loadQuizById,
    getTopicOptions: getTopicOptions
  };
};

module.exports = createQuizpetGeneratorService;
