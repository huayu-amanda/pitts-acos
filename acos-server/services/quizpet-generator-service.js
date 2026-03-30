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

var buildQuizResponse = function(quiz, quizId, code) {
  var q = quiz || {};
  var resolvedCode = code || '';
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
    codeHeaderFileName: codeHeaderFileName || ''
  };
};

var createQuizpetGeneratorService = function(deps) {
  deps = deps || {};

  var httpGetJson = deps.httpGetJson;
  var getQuizPetBaseUrl = deps.getQuizPetBaseUrl;
  var pickQuizFromServerMessage = deps.pickQuizFromServerMessage;
  var tryFetchQuizCode = deps.tryFetchQuizCode;
  var getFetchQuizDiagnostic = deps.getFetchQuizDiagnostic;

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
    var quizByIdUrl = baseUrl + '/quiz/id/' + quizId;
    var metadataError = null;

    return Promise.resolve()
      .then(function() {
        // QuizPet may redirect unauthenticated requests to an HTML login page.
        // Treat non-JSON metadata as recoverable and still try code fetch fallback.
        return httpGetJson(quizByIdUrl).catch(function(err) {
          metadataError = err || null;
          return null;
        });
      })
      .then(function(serverMessage) {
        var quiz = pickQuizFromServerMessage(serverMessage) || null;
        var hasNoSuchQuizId = !!(serverMessage && typeof serverMessage.message === 'string' && /no such quiz id/i.test(serverMessage.message));

        var codePromise = Promise.resolve(quiz && quiz.code ? quiz.code : '');
        if (typeof tryFetchQuizCode === 'function') {
          codePromise = Promise.resolve(tryFetchQuizCode(quizId, baseUrl)).catch(function() {
            return null;
          }).then(function(fetchedCode) {
            return fetchedCode || (quiz && quiz.code) || '';
          });
        }

        return codePromise.then(function(code) {
          if (!quiz && !code) {
            var fetchDiag = (typeof getFetchQuizDiagnostic === 'function') ? getFetchQuizDiagnostic() : null;

            if (hasNoSuchQuizId || (fetchDiag && fetchDiag.kind === 'no-such-quiz-id')) {
              throw new Error('QuizPet returned "No such quiz id." for quiz ID ' + quizId + '.');
            }

            var fetchStatusCode = fetchDiag && fetchDiag.statusCode ? fetchDiag.statusCode : null;
            var metadataStatusCode = metadataError && metadataError.statusCode ? metadataError.statusCode : null;
            if (fetchStatusCode === 500 || metadataStatusCode === 500) {
              throw new Error('QuizPet returned HTTP 500 for quiz ID ' + quizId + ' (remote backend error).');
            }

            if (fetchDiag && fetchDiag.kind === 'non-json') {
              var ct = fetchDiag.contentType ? fetchDiag.contentType : 'unknown content-type';
              var sc = fetchDiag.statusCode ? fetchDiag.statusCode : 'unknown status';
              throw new Error('QuizPet returned non-JSON for quiz ID ' + quizId + ' (HTTP ' + sc + ', ' + ct + ').');
            }

            throw new Error('QuizPet did not return usable quiz data for quiz ID ' + quizId + '.');
          }
          return buildQuizResponse(quiz, quizId, code);
        });
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
