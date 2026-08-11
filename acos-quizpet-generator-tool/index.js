"use strict";

var registerQuizpetGeneratorRoutes = require("./routes/quizpet-generator");

exports.packageType = "tool";
exports.namespace = "quizpet-generator";

exports.register = function registerQuizpetGeneratorTool(handlers, app) {
  handlers.tools["quizpet-generator"] = {
    namespace: "quizpet-generator",
    meta: {
      name: "quizpet-generator",
      title: "quizpet-generator",
      description: "Import QuizPet quizzes into jstracing content packages."
    }
  };

  handlers.tools["quizpet-generator-pitts"] = {
    namespace: "quizpet-generator-pitts",
    meta: {
      name: "quizpet-generator-pitts",
      title: "quizpet-generator-pitts",
      description: "QuizPet generator route for PITTS source."
    }
  };

  registerQuizpetGeneratorRoutes(app, handlers);
};
