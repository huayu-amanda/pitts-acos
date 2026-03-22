"use strict";

var quizpetTopicOptions = require('./quizpet-topic-options');

var buildQuizResponse = function(quiz, quizId, code) {
  var q = quiz || {};
  return {
    quizId: q.quizId || quizId,
    topicId: q.topicId || null,
    rdfId: q.rdfId || '',
    title: q.title || ('Quiz ' + quizId),
    description: q.decp || q.description || '',
    question: q.decp || q.question || q.description || '',
    code: code || ''
  };
};

var createQuizpetGeneratorService = function(deps) {
  deps = deps || {};

  var httpGetJson = deps.httpGetJson;
  var getQuizPetBaseUrl = deps.getQuizPetBaseUrl;
  var pickQuizFromServerMessage = deps.pickQuizFromServerMessage;
  var tryFetchQuizCode = deps.tryFetchQuizCode;

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

    return Promise.resolve()
      .then(function() {
        // QuizPet may redirect unauthenticated requests to an HTML login page.
        // Treat non-JSON metadata as recoverable and still try code fetch fallback.
        return httpGetJson(quizByIdUrl).catch(function() {
          return null;
        });
      })
      .then(function(serverMessage) {
        var quiz = pickQuizFromServerMessage(serverMessage) || null;

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
            throw new Error('QuizPet returned non-JSON (likely a login page) and no code could be fetched.');
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
