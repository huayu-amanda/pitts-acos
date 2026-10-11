(function () {
  var serverConfig = window.JSTRACING_SERVER_CONFIG || {};
  var cheerpjRuntimeBaseUrl = String(
    serverConfig.cheerpjRuntimeBaseUrl || "https://cjrtnc.leaningtech.com/4.3/"
  ).replace(/\/+$/, "") + "/";

  // Centralized runtime version/config block.
  // Update only this file when bumping browser runtime versions.
  window.JSTRACING_RUNTIME = {
    pyodide: {
      version: "0.26.2",
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
      scriptURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js",
    },
    cheerpj: {
      version: "4.3",
      baseURL: cheerpjRuntimeBaseUrl,
      scriptURL: cheerpjRuntimeBaseUrl + "loader.js",
    },
  };
})();
