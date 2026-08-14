"use strict";

const fs = require("fs");
const path = require("path");

const staticDir = path.join(__dirname, "..", "static");

const main = () => {
  const requiredFiles = [
    path.join(staticDir, "body.html"),
    path.join(staticDir, "css", "jstracing.css"),
    path.join(staticDir, "js", "jstracing.js"),
    path.join(staticDir, "js", "runtime-config.js"),
  ];

  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required static file: ${filePath}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log("[acos-jstracing] static assets verified at acos-jstracing-type/static");
};

main();
