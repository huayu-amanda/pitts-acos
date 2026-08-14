"use strict";

const registerType = require("./acos-jstracing-type");
const registerPythonPackage = require("./acos-jstracing-python");
const registerJavaPackage = require("./acos-jstracing-java");

exports.packageType = "content-type";
exports.namespace = "jstracing";
// Keep /static/jstracing behavior while moving static assets under acos-jstracing-type.
exports.staticDir = "acos-jstracing-type/static";

exports.register = function registerJSTracing(handlers, app, config) {
  registerType.register(handlers, app, config);
  registerPythonPackage.register(handlers, app, config);
  registerJavaPackage.register(handlers, app, config);
};
