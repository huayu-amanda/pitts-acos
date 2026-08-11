"use strict";

const registerType = require("../packages/acos-jstracing-type");
const registerPythonPackage = require("../packages/acos-jstracing-python");
const registerJavaPackage = require("../packages/acos-jstracing-java");

exports.packageType = "content-type";
exports.namespace = "jstracing";

exports.register = function registerJSTracing(handlers, app, config) {
  registerType.register(handlers, app, config);
  registerPythonPackage.register(handlers, app, config);
  registerJavaPackage.register(handlers, app, config);
};