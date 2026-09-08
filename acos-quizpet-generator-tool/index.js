"use strict";

var path = require("path");
var registerQuizpetGeneratorRoutes = require("./routes/quizpet-generator");

exports.packageType = "tool";
exports.namespace = "quizpet-generator";

exports.register = function registerQuizpetGeneratorTool(handlers, app, config) {
  // Register this tool's own templates with the host Nunjucks environment.
  var nunjucksEnv = app.get("nunjucksEnv");
  var viewDirectory = path.join(__dirname, "views");

  if (!nunjucksEnv || !nunjucksEnv.loaders || !nunjucksEnv.loaders.length ||
      !Array.isArray(nunjucksEnv.loaders[0].searchPaths)) {
    throw new Error("acos-quizpet-generator-tool requires the ACOS Nunjucks view environment.");
  }

  if (nunjucksEnv.loaders[0].searchPaths.indexOf(viewDirectory) === -1) {
    nunjucksEnv.loaders[0].searchPaths.unshift(viewDirectory);
    nunjucksEnv.loaders[0].cache = {};
  }

  handlers.tools["quizpet-generator"] = {
    namespace: "quizpet-generator",
    meta: {
      name: "quizpet-generator",
      title: "quizpet-generator",
      description: "Import QuizPet quizzes into jstracing content packages."
    }
  };

  registerQuizpetGeneratorRoutes(app, handlers, config);
};
