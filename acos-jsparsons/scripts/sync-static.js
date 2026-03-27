"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "lib", "jsparsons", "frontend");
const outDir = path.join(root, "static");

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

const main = () => {
  const pairs = [
    [path.join(srcDir, "acos-jsparsons.js"), path.join(outDir, "acos-jsparsons.js")],
    [path.join(srcDir, "jsparsons.css"), path.join(outDir, "jsparsons.css")]
  ];

  for (const [from, to] of pairs) {
    if (!fs.existsSync(from)) {
      throw new Error(`Missing source file: ${from}`);
    }
    copy(from, to);
  }

  console.log("[acos-jsparsons] synced static assets from lib/jsparsons/frontend -> static/");
};

main();
