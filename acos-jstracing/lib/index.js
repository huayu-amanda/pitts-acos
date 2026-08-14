"use strict";

const registerType = require("../acos-jstracing-type");
const registerPythonPackage = require("../acos-jstracing-python");
const registerJavaPackage = require("../acos-jstracing-java");

exports.packageType = "content-type";
exports.namespace = "jstracing";

exports.register = function registerJSTracing(handlers, app, config) {
  registerType.register(handlers, app, config);
  registerPythonPackage.register(handlers, app, config);
  registerJavaPackage.register(handlers, app, config);
};