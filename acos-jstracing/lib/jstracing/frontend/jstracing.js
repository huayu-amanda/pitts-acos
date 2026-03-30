(function () {
  const data = window.JSTRACING_EXERCISE || {};
  const session = window.JSTRACING_SESSION || {};
  const meta = window.JSTRACING_META || {};

  const titleEl = document.getElementById("exercise-title");
  const descEl = document.getElementById("exercise-desc");
  const questionEl = document.getElementById("exercise-question");
  const languageTitleEl = document.getElementById("code-language-title");
  const codeTabsEl = document.getElementById("code-tabs");
  const editorEl = document.getElementById("code-editor");
  const answerEl = document.getElementById("answer-input");
  const resultEl = document.getElementById("run-result");
  const statusEl = document.getElementById("pyodide-status");
  const runBtn = document.getElementById("run-btn");

  if (titleEl) {
    titleEl.textContent = data.title || "JSTracing exercise";
  }
  if (descEl) {
    descEl.textContent = data.description || "";
  }
  if (questionEl) {
    questionEl.textContent = data.question || "What is the output?";
  }

  const initialCode = session.code || data.code || "";
  answerEl.value = session.answer || "";
  resultEl.textContent = session.verdict || "";
  resultEl.className = "result-value" + (session.verdict === "Success" ? " success" : session.verdict === "Wrong" ? " wrong" : "");

  const normalizeLanguage = (value) => {
    const v = String(value || "").trim().toLowerCase();
    return v === "java" ? "java" : "python";
  };

  const formatJavaCodeForDisplay = (code) => {
    const src = String(code || "").replace(/\r\n/g, "\n");
    if (!src.trim()) return src;

    const out = [];
    let inString = false;
    let quote = "";
    let escapeNext = false;
    let parenDepth = 0;

    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (inString) {
        out.push(ch);
        if (escapeNext) {
          escapeNext = false;
        } else if (ch === "\\") {
          escapeNext = true;
        } else if (ch === quote) {
          inString = false;
          quote = "";
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        quote = ch;
        out.push(ch);
        continue;
      }
      if (ch === "(") {
        parenDepth += 1;
        out.push(ch);
        continue;
      }
      if (ch === ")") {
        if (parenDepth > 0) parenDepth -= 1;
        out.push(ch);
        continue;
      }
      if (ch === "{") {
        out.push("{");
        out.push("\n");
        continue;
      }
      if (ch === "}") {
        out.push("\n");
        out.push("}");
        out.push("\n");
        continue;
      }
      if (ch === ";" && parenDepth === 0) {
        out.push(";");
        out.push("\n");
        continue;
      }
      out.push(ch);
    }

    const lines = out
      .join("")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let level = 0;
    const pretty = [];
    for (const line of lines) {
      if (line.startsWith("}")) {
        level = Math.max(0, level - 1);
      }
      pretty.push(`${"    ".repeat(level)}${line}`);
      if (line.endsWith("{")) {
        level += 1;
      }
    }

    return pretty.join("\n");
  };

  const codeLanguage = normalizeLanguage(data.language);
  const isPythonMode = codeLanguage === "python";
  const inferMainFileNameFromCode = (code) => {
    const src = String(code || "").replace(/\r\n/g, "\n");
    const lines = src.split("\n");
    for (const rawLine of lines) {
      const line = String(rawLine || "").trim();
      if (!line) {
        continue;
      }
      const candidate = line
        .replace(/^#+\s*/, "")
        .replace(/^\/\/+\s*/, "")
        .replace(/^\/\*+\s*/, "")
        .replace(/\*\/\s*$/, "")
        .trim();
      if (/^[a-zA-Z0-9_.-]+\.(py|java)$/i.test(candidate)) {
        return candidate;
      }
      break;
    }
    return codeLanguage === "java" ? "Main.java" : "main.py";
  };

  const formatCodeForDisplay = (code, fileName) => {
    const name = String(fileName || "").toLowerCase();
    if (codeLanguage === "java" || name.endsWith(".java")) {
      return formatJavaCodeForDisplay(code);
    }
    return String(code || "");
  };

  const normalizeSupportFiles = () => {
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
        return { name, content };
      })
      .filter(Boolean);
  };

  const mainFileName = String(data.mainFileName || "").trim() || inferMainFileNameFromCode(initialCode);
  const codeTabs = [{
    name: mainFileName,
    content: initialCode,
    isMain: true,
  }].concat(
    normalizeSupportFiles().map((file) => ({
      name: file.name,
      content: file.content,
      isMain: false,
    }))
  );

  let activeCodeTab = 0;
  let mainCode = initialCode;

  const renderCodeTab = () => {
    const active = codeTabs[activeCodeTab] || codeTabs[0];
    if (!active) {
      editorEl.value = "";
      return;
    }
    editorEl.value = formatCodeForDisplay(active.content, active.name);
  };

  const renderCodeTabs = () => {
    if (!codeTabsEl) {
      renderCodeTab();
      return;
    }
    codeTabsEl.innerHTML = "";
    codeTabs.forEach((tab, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-tab" + (index === activeCodeTab ? " active" : "");
      btn.textContent = tab.name;
      btn.addEventListener("click", () => {
        activeCodeTab = index;
        renderCodeTabs();
        renderCodeTab();
      });
      codeTabsEl.appendChild(btn);
    });
    renderCodeTab();
  };

  editorEl.readOnly = true;
  renderCodeTabs();

  if (languageTitleEl) {
    languageTitleEl.textContent = isPythonMode ? "Python" : "Java";
  }

  let pyodide = null;
  let pyodideReady = false;

  const setStatus = (text, variant) => {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = text;
    statusEl.className = "status" + (variant ? ` ${variant}` : "");
    statusEl.style.display = variant === "ready" ? "none" : "inline-flex";
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
    if (!isPythonMode) {
      return;
    }
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

  const getStaticExpectedResultForJava = () => {
    if (typeof data.expectedResult === "string" && data.expectedResult.length) {
      return data.expectedResult;
    }
    if (typeof session.expectedResult === "string" && session.expectedResult.length) {
      return session.expectedResult;
    }
    if (typeof session.result === "string" && session.result.length) {
      return session.result;
    }
    return null;
  };

  const getSupportFiles = () => normalizeSupportFiles()
    .filter((file) => !(file.name.includes("..") || file.name.startsWith("/") || file.name.startsWith("\\")));

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
    if (!isPythonMode) {
      const staticExpected = getStaticExpectedResultForJava();
      if (staticExpected === null) {
        throw new Error("Java mode requires exercise.expectedResult for Run/Check.");
      }
      return { expectedResult: staticExpected, durationMs: null };
    }
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
    const code = mainCode || "";
    runBtn.disabled = true;
    setStatus("Submitting...", "running");

    const attemptId = makeAttemptId();

    try {
      const { expectedResult, durationMs } = await computeExpectedResult(code);
      lastExpectedResult = expectedResult;

      const studentAnswer = answerEl.value || "";
      const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(expectedResult);
      resultEl.textContent = isCorrect ? "Success" : `Wrong | Expect Result: ${expectedResult}`;
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
      setStatus("Submitted", "ready");
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
      setStatus("Submit failed", "error");
    } finally {
      runBtn.disabled = false;
    }
  };

  runBtn.addEventListener("click", runCode);

  if (isPythonMode) {
    initPyodide().catch((err) => {
      console.error("Pyodide init failed:", err);
      setStatus("Pyodide load failed", "error");
    });
  } else {
    setStatus("Java mode: Submit uses built-in expectedResult", "ready");
  }
})();