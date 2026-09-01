"use strict";

var registerQuizpetGeneratorRoutes = require("./routes/quizpet-generator");

exports.packageType = "tool";
exports.namespace = "quizpet-generator";

exports.register = function registerQuizpetGeneratorTool(handlers, app, config) {
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
