"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "packages", "acos-jstracing-type", "static");
const outDir = path.join(root, "static");

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

const main = () => {
  const pairs = [
    [path.join(srcDir, "js", "jstracing.js"), path.join(outDir, "jstracing.js")],
    [path.join(srcDir, "css", "jstracing.css"), path.join(outDir, "jstracing.css")],
    [path.join(srcDir, "js", "runtime-config.js"), path.join(outDir, "runtime-config.js")],
  ];

  for (const [from, to] of pairs) {
    if (!fs.existsSync(from)) {
      throw new Error(`Missing source file: ${from}`);
    }
    copy(from, to);
  }

  // eslint-disable-next-line no-console
  console.log("[acos-jstracing] synced static assets from packages/acos-jstracing-type/static -> static/");
};

main();
