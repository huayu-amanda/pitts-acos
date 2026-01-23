"use strict";

const path = require("path");
const fs = require("fs");

// 引入内容类型对象（./jstracing/index.js）
const JSTracing = require("./jstracing");

/**
 * 这两行是给 acos-server/app.js 的 auto-discovery 用的：
 *   var pkg = require('acos-jstracing');
 *   if (pkg.packageType) { ... }
 */
exports.packageType = "content-type";
exports.namespace = "jstracing";

exports.register = function (handlers, app, config) {
  // 保存 handlers 供内容类型 handleEvent 使用
  JSTracing.handlers = handlers;
  // 1. 注册 content type：名称 "jstracing"
  //    让它出现在首页的 Installed content types 里
  handlers.contentTypes["jstracing"] = JSTracing;

  // 确保有 installedContentPackages 数组
  JSTracing.installedContentPackages =
    JSTracing.installedContentPackages || [];

  // 2. 读取并注册本包里的 content package：jstracing-python
  //    目录：<包根>/jstracing-python/manifest.json
  const pkgDir = path.join(__dirname, "..", "jstracing-python");
  const manifestPath = path.join(pkgDir, "manifest.json");

  // 如果没有 manifest.json，就直接返回（避免启动时报错）
  if (!fs.existsSync(manifestPath)) {
    console.warn(
      "[acos-jstracing] WARN: manifest.json not found in " + pkgDir
    );
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  // 构造 ACOS 需要的 content package 对象
  const contentPackage = {
    // 元数据
    meta: {
      name: manifest.id, // "jstracing-python"
      title: manifest.title,
      description: manifest.description,
      type: manifest.type, // "jstracing"
      keywords: manifest.keywords || [],
      contents: {}, // 下面会根据 manifest.files 填充
    },

    // 自定义字段：方便 content type 知道包目录在哪
    dir: pkgDir,
  };

  // 根据 manifest.files 构造 contents 列表
  //
  // 你的 manifest.json:
  // {
  //   "id": "jstracing-python",
  //   "title": "JSTracing Python examples",
  //   "description": "Tracing exercises for Python.",
  //   "type": "jstracing",
  //   "files": [
  //     { "name": "point_above_below.json", "role": "exercise" }
  //   ]
  // }
  //
  // 我们会把它转成：
  // contents: {
  //   "point_above_below": {
  //     name: "point_above_below",
  //     file: "point_above_below.json",
  //     role: "exercise"
  //   }
  // }
  (manifest.files || []).forEach((file) => {
    if (file.role === "exercise") {
      // 去掉 .json 后缀，作为练习名
      const name = file.name.replace(/\.json$/i, "");
      contentPackage.meta.contents[name] = {
        name,
        file: file.name,
        role: file.role,
      };
    }
  });

  const id = contentPackage.meta.name;   // "jstracing-python"
  const type = contentPackage.meta.type; // "jstracing"

  // 包自身的各种名字
  contentPackage.name = id;
  contentPackage.package = id;
  contentPackage.id = id;
  contentPackage.namespace = id;             // ★ 关键：给 index.html 用

  // 内容类型相关
  contentPackage.type = type;
  contentPackage.contentType = type;
  contentPackage.contentTypeNamespace = type; // ★ 关键：给 index.html 用

  // 其他展示用元数据
  contentPackage.contents = contentPackage.meta.contents;
  contentPackage.title = contentPackage.meta.title;
  contentPackage.description = contentPackage.meta.description;

  console.log("[acos-jstracing] DEBUG contentPackage:",
    JSON.stringify(contentPackage, null, 2));

  // 3. 把 content package 挂到 handlers 上
  //  这样它会出现在首页的 Installed content packages 里
  handlers.contentPackages[contentPackage.meta.name] = contentPackage;

  // 4. 也挂到对应 content type 的 installedContentPackages 里
  JSTracing.installedContentPackages.push(contentPackage);

  console.log(
    "[acos-jstracing] INFO: content type 'jstracing' and content package '" +
      contentPackage.meta.name +
      "' registered."
  );
};