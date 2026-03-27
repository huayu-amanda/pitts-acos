(function () {
  const data = window.JSTRACING_EXERCISE || {};
  const session = window.JSTRACING_SESSION || {};
  const meta = window.JSTRACING_META || {};

  const titleEl = document.getElementById("exercise-title");
  const descEl = document.getElementById("exercise-desc");
  const questionEl = document.getElementById("exercise-question");
  const editorEl = document.getElementById("code-editor");
  const answerEl = document.getElementById("answer-input");
  const resultEl = document.getElementById("run-result");
  const expectedEl = document.getElementById("expected-output");
  const statusEl = document.getElementById("pyodide-status");
  const runBtn = document.getElementById("run-btn");
  const saveBtn = document.getElementById("save-btn");
  const checkBtn = document.getElementById("check-btn");

  titleEl.textContent = data.title || "JSTracing exercise";
  descEl.textContent = data.description || "";
  questionEl.textContent = data.question || "What is the output?";

  editorEl.value = session.code || data.code || "";
  answerEl.value = session.answer || "";
  resultEl.textContent = session.verdict || "";
  resultEl.className = "result-value" + (session.verdict === "Success" ? " success" : session.verdict === "Wrong" ? " wrong" : "");
  // Do not show expected result on load; only reveal after Check.
  expectedEl.textContent = "";

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

  const makeAttemptId = () => {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (_e) {
      // ignore
    }
    return `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const sendAcosEvent = async (eventName, payloadObj) => {
    // Prefer protocol-provided event sender, since it can attach protocolData (e.g., LMS/LTI identifiers)
    if (window.ACOS && typeof window.ACOS.sendEvent === "function") {
      return new Promise((resolve) => {
        try {
          window.ACOS.sendEvent(eventName, payloadObj, () => resolve());
        } catch (e) {
          console.warn("ACOS.sendEvent failed; falling back to fetch:", e);
          resolve();
        }
      });
    }

    // Fallback: direct POST to /event (protocolData will be empty)
    try {
      await fetch(eventUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventName,
          payload: JSON.stringify(payloadObj),
          protocolData: JSON.stringify({}),
        }),
      });
    } catch (err) {
      console.warn("Failed to send event:", eventName, err);
    }
  };

  const saveSession = async (code, result) => {
    try {
      await sendAcosEvent("saveSession", {
        contentPackage: meta.contentPackage || "",
        exerciseName: meta.exerciseName || "",
        code,
        // Backward compatible: keep `result` for older server/frontends.
        // New fields used by the updated UX.
        result,
        answer: answerEl.value || "",
        expectedResult: lastExpectedResult || session.expectedResult || session.result || "",
        verdict: (resultEl && resultEl.textContent) ? resultEl.textContent : "",
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Failed to save session:", err);
    }
  };

  const normalizeAnswer = (value) => {
    if (value === null || value === undefined) return "";
    const s = String(value)
      .replace(/\r\n/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, " ");
    // Normalize line-by-line so harmless whitespace differences do not cause false negatives.
    return s
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .trim();
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

  let lastExpectedResult = session.expectedResult || session.result || "";

  const getSupportFiles = () => {
    if (!Array.isArray(data.supportFiles)) {
      return [];
    }
    return data.supportFiles
      .map((item) => {
        const name = String((item && item.name) || "").trim();
        const content = String((item && item.content) || "");
        if (!name || !content.trim()) {
          return null;
        }
        if (name.includes("..") || name.startsWith("/") || name.startsWith("\\")) {
          return null;
        }
        return { name, content };
      })
      .filter(Boolean);
  };

  const ensurePyodideDir = (absPath) => {
    const normalized = String(absPath || "/").replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      try {
        pyodide.FS.stat(current);
      } catch (_e) {
        pyodide.FS.mkdir(current);
      }
    }
  };

  const loadSupportFilesIntoPyodide = async () => {
    const files = getSupportFiles();
    if (!files.length) {
      return;
    }

    for (const file of files) {
      const fsPath = `/${file.name}`.replace(/\/+/g, "/");
      const lastSlash = fsPath.lastIndexOf("/");
      const dirPath = lastSlash > 0 ? fsPath.slice(0, lastSlash) : "/";
      ensurePyodideDir(dirPath);
      pyodide.FS.writeFile(fsPath, file.content, { encoding: "utf8" });
    }

    await pyodide.runPythonAsync("import sys\nif '/' not in sys.path:\n    sys.path.insert(0, '/')");
  };

  const computeExpectedResult = async (code) => {
    if (!pyodideReady) {
      await initPyodide();
    }

    await loadSupportFilesIntoPyodide();

    const stdout = [];
    const stderr = [];
    pyodide.setStdout({ batched: (text) => stdout.push(text) });
    pyodide.setStderr({ batched: (text) => stderr.push(text) });

    const start = performance.now();
    await pyodide.runPythonAsync(code);
    const duration = performance.now() - start;

    const outputText = [stdout.join(""), stderr.join("")].filter(Boolean).join("\n");
    return { expectedResult: outputText || "(no output)", durationMs: duration };
  };

  const runCode = async () => {
    const code = editorEl.value || "";
    runBtn.disabled = true;
    saveBtn.disabled = true;
    checkBtn.disabled = true;
    setStatus("Running...", "running");

    const attemptId = makeAttemptId();

    try {
      const { expectedResult, durationMs } = await computeExpectedResult(code);
      lastExpectedResult = expectedResult;

      const studentAnswer = answerEl.value || "";
      const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(expectedResult);
      resultEl.textContent = isCorrect ? "Success" : "Wrong";
      resultEl.className = "result-value" + (isCorrect ? " success" : " wrong");

      // Send grading event (to be forwarded by acos-server to QuizPetAuthoring)
      await sendAcosEvent("grade", {
        attemptId,
        points: isCorrect ? 1 : 0,
        max_points: 1,
        verdict: isCorrect ? "Success" : "Wrong",
        answer: answerEl.value || "",
        expectedResult,
        durationMs,
        submittedAt: new Date().toISOString(),
        // Exercise + backend identifiers
        quizId: data.quizId ?? null,
        topicId: data.topicId ?? null,
        rdfId: data.rdfId ?? null,
        contentPackage: meta.contentPackage || "",
        exerciseName: meta.exerciseName || "",
        exerciseId: data.id || meta.exerciseName || "",
        title: data.title || "",
      });

      // Persist: answer + expected + verdict
      await saveSession(code, expectedResult);
      setStatus("Run completed", "ready");
    } catch (err) {
      const errorText = err && err.message ? err.message : String(err);
      lastExpectedResult = errorText;
      resultEl.textContent = "Wrong";
      resultEl.className = "result-value wrong";

      // Even on failure, send a grade event with points=0 for observability
      await sendAcosEvent("grade", {
        attemptId,
        points: 0,
        max_points: 1,
        verdict: "Error",
        answer: answerEl.value || "",
        expectedResult: errorText,
        durationMs: null,
        submittedAt: new Date().toISOString(),
        quizId: data.quizId ?? null,
        topicId: data.topicId ?? null,
        rdfId: data.rdfId ?? null,
        contentPackage: meta.contentPackage || "",
        exerciseName: meta.exerciseName || "",
        exerciseId: data.id || meta.exerciseName || "",
        title: data.title || "",
      });

      await saveSession(code, errorText);
      setStatus("Run failed", "error");
    } finally {
      runBtn.disabled = false;
      saveBtn.disabled = false;
      checkBtn.disabled = false;
    }
  };

  runBtn.addEventListener("click", runCode);
  saveBtn.addEventListener("click", () => saveSession(editorEl.value || "", lastExpectedResult || ""));

  checkBtn.addEventListener("click", async () => {
    const code = editorEl.value || "";
    checkBtn.disabled = true;
    runBtn.disabled = true;
    saveBtn.disabled = true;
    setStatus("Checking...", "running");
    try {
      const { expectedResult } = await computeExpectedResult(code);
      lastExpectedResult = expectedResult;
      expectedEl.textContent = lastExpectedResult;

      const studentAnswer = answerEl.value || "";
      const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(lastExpectedResult);
      resultEl.textContent = isCorrect ? "Success" : "Wrong";
      resultEl.className = "result-value" + (isCorrect ? " success" : " wrong");

      await saveSession(code, lastExpectedResult);
      setStatus("Expected result shown", "ready");
    } catch (err) {
      const errorText = err && err.message ? err.message : String(err);
      lastExpectedResult = errorText;
      expectedEl.textContent = errorText;
      await saveSession(code, errorText);
      setStatus("Check failed", "error");
    } finally {
      checkBtn.disabled = false;
      runBtn.disabled = false;
      saveBtn.disabled = false;
    }
  });

  initPyodide().catch((err) => {
    console.error("Pyodide init failed:", err);
    setStatus("Pyodide load failed", "error");
  });
})();