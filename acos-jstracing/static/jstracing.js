(function () {
  const data = window.JSTRACING_EXERCISE || {};
  const session = window.JSTRACING_SESSION || {};
  const meta = window.JSTRACING_META || {};

  const titleEl = document.getElementById("exercise-title");
  const descEl = document.getElementById("exercise-desc");
  const questionEl = document.getElementById("exercise-question");
  const editorEl = document.getElementById("code-editor");
  const outputEl = document.getElementById("output");
  const statusEl = document.getElementById("pyodide-status");
  const runTimeEl = document.getElementById("run-time");
  const runBtn = document.getElementById("run-btn");
  const saveBtn = document.getElementById("save-btn");

  titleEl.textContent = data.title || "JSTracing exercise";
  descEl.textContent = data.description || "";
  questionEl.textContent = data.question || "What is the output?";

  editorEl.value = session.code || data.code || "";
  outputEl.textContent = session.result || "";

  let pyodide = null;
  let pyodideReady = false;

  const setStatus = (text, variant) => {
    statusEl.textContent = text;
    statusEl.className = "status" + (variant ? ` ${variant}` : "");
  };

  const eventUrl = (() => {
    const path = window.location.pathname.replace(/\/$/, "");
    return `${window.location.origin}${path}/event`;
  })();

  const saveSession = async (code, result) => {
    try {
      await fetch(eventUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "saveSession",
          payload: JSON.stringify({
            contentPackage: meta.contentPackage || "",
            exerciseName: meta.exerciseName || "",
            code,
            result,
            updatedAt: new Date().toISOString(),
          }),
          protocolData: JSON.stringify({}),
        }),
      });
    } catch (err) {
      console.warn("Failed to save session:", err);
    }
  };

  const initPyodide = async () => {
    if (pyodideReady) {
      return;
    }
    setStatus("Loading Pyodide...", "loading");
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
    });
    pyodideReady = true;
    setStatus("Pyodide ready", "ready");
  };

  const runCode = async () => {
    const code = editorEl.value || "";
    runBtn.disabled = true;
    saveBtn.disabled = true;
    setStatus("Running...", "running");

    try {
      if (!pyodideReady) {
        await initPyodide();
      }

      const stdout = [];
      const stderr = [];

      pyodide.setStdout({ batched: (text) => stdout.push(text) });
      pyodide.setStderr({ batched: (text) => stderr.push(text) });

      const start = performance.now();
      await pyodide.runPythonAsync(code);
      const duration = performance.now() - start;

      const outputText = [stdout.join(""), stderr.join("")]
        .filter(Boolean)
        .join("\n");

      outputEl.textContent = outputText || "(no output)";
      runTimeEl.textContent = `Last run: ${duration.toFixed(0)} ms`;

      await saveSession(code, outputEl.textContent);
      setStatus("Run completed", "ready");
    } catch (err) {
      const errorText = err && err.message ? err.message : String(err);
      outputEl.textContent = errorText;
      await saveSession(code, errorText);
      setStatus("Run failed", "error");
    } finally {
      runBtn.disabled = false;
      saveBtn.disabled = false;
    }
  };

  runBtn.addEventListener("click", runCode);
  saveBtn.addEventListener("click", () => saveSession(editorEl.value || "", outputEl.textContent || ""));

  initPyodide().catch((err) => {
    console.error("Pyodide init failed:", err);
    setStatus("Pyodide load failed", "error");
  });
})();