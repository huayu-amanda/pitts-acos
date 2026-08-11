(function () {
  const data = window.JSTRACING_EXERCISE || {};
  const session = window.JSTRACING_SESSION || {};
  const meta = window.JSTRACING_META || {};
  const runtime = window.JSTRACING_RUNTIME || {};
  const runtimePyodide = runtime.pyodide || {};
  const CHEERPJ_LOADER_URL = "https://cjrtnc.leaningtech.com/4.2/loader.js";
  const DEFAULT_JAVA_TIMEOUT_MS = 20000;

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
  const javaCompileEl = document.getElementById("console");
  const javaDisplayEl = document.getElementById("cheerpjDisplay");

  if (titleEl) {
    titleEl.textContent = data.title || "JSTracing exercise";
  }
  if (descEl) {
    descEl.textContent = data.description || "";
  }
  if (questionEl) {
    questionEl.textContent = data.question || "What is the output?";
  }

  // Use imported exercise code as the single source of truth.
  // Keep session fallback commented out to avoid stale code overriding a fresh import.
  // const initialCode = data.code || session.code || "";
  const initialCode = data.code || "";
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
  const isJavaMode = codeLanguage === "java";

  const resolveJavaExecutionMode = () => {
    const v = String(
      (data && data.java && data.java.executionMode)
      || data.javaExecutionMode
      || (meta && meta.javaExecutionMode)
      || ""
    ).trim().toLowerCase();
    if (v === "cheerpj") return "cheerpj";
    if (v === "static") return "static";
    return "cheerpj";
  };

  const javaExecutionMode = resolveJavaExecutionMode();

  const resolveNumberOrDefault = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const resolveJavaTimeoutMs = () => {
    const configured = resolveNumberOrDefault(
      (data && data.java && data.java.timeoutMs) || data.javaTimeoutMs,
      DEFAULT_JAVA_TIMEOUT_MS
    );
    // CheerpJ + ECJ warmup can exceed a few seconds on first run; keep a safe floor.
    return Math.max(configured, DEFAULT_JAVA_TIMEOUT_MS);
  };

  const javaRuntimeConfig = {
    executionMode: javaExecutionMode,
    scriptUrl: String(
      (data && data.java && data.java.cheerpjScriptUrl)
      || data.cheerpjScriptUrl
      || CHEERPJ_LOADER_URL
      || ""
    ).trim(),
    timeoutMs: resolveJavaTimeoutMs(),
    mainClass: String(
      (data && data.java && data.java.mainClass)
      || data.mainClass
      || ""
    ).trim(),
  };
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

  const waitForLoadPyodide = (timeoutMs = 15000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (typeof window.loadPyodide === "function") {
        resolve(window.loadPyodide);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("loadPyodide is not available yet"));
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });

  const setStatus = (text, variant) => {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = text;
    statusEl.className = "status" + (variant ? ` ${variant}` : "");
    statusEl.style.display = variant === "ready" ? "none" : "inline-flex";
  };

  let cheerpjReady = false;
  let cheerpjLoaderPromise = null;
  let cheerpjInitPromise = null;
  let toolsJarPromise = null;

  const loadExternalScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-jstracing-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.jstracingSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "1";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  const getJavaOutputText = () => {
    const compileText = javaCompileEl ? String(javaCompileEl.innerText || "").trim() : "";
    const runText = javaDisplayEl ? String(javaDisplayEl.innerText || "").trim() : "";
    return [compileText, runText].filter(Boolean).join("\n");
  };

  const initCheerpj = async () => {
    if (!isJavaMode || javaRuntimeConfig.executionMode !== "cheerpj") {
      return;
    }
    if (cheerpjReady) {
      return;
    }
    if (!cheerpjLoaderPromise) {
      const scriptUrl = javaRuntimeConfig.scriptUrl || CHEERPJ_LOADER_URL;
      cheerpjLoaderPromise = loadExternalScript(scriptUrl);
    }

    if (!cheerpjInitPromise) {
      cheerpjInitPromise = (async () => {
        setStatus("Loading Java runtime...", "loading");
        await cheerpjLoaderPromise;

        if (typeof window.cheerpjInit !== "function") {
          throw new Error("cheerpjInit not available after loader script loaded");
        }

        await window.cheerpjInit({
          status: "none",
          version: 8,
        });

        if (typeof window.cheerpjCreateDisplay === "function" && javaDisplayEl) {
          window.cheerpjCreateDisplay(-1, -1, javaDisplayEl);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        cheerpjReady = true;
        setStatus("Java runtime ready", "ready");
      })();
    }

    try {
      await cheerpjInitPromise;
    } catch (e) {
      cheerpjInitPromise = null;
      cheerpjReady = false;
      throw e;
    }
  };

  const ensureJavaCompiler = async () => {
    if (!toolsJarPromise) {
      toolsJarPromise = Promise.resolve();
    }
    await toolsJarPromise;
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
    const loadPyodideFn = await waitForLoadPyodide();
    pyodide = await loadPyodideFn({
      indexURL: String(runtimePyodide.indexURL || "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"),
    });
    pyodideReady = true;
    setStatus("Pyodide ready", "ready");
  };

  let lastExpectedResult = session.expectedResult || session.result || "";

  const getStaticExpectedResultForJava = () => {
    if (typeof data.expectedResult === "string" && data.expectedResult.length) {
      return data.expectedResult;
    }
    if (typeof data.result === "string" && data.result.length) {
      return data.result;
    }
    if (typeof data.answer === "string" && data.answer.length) {
      return data.answer;
    }
    if (typeof data.correct_answer === "string" && data.correct_answer.length) {
      return data.correct_answer;
    }
    if (typeof data.correctAnswer === "string" && data.correctAnswer.length) {
      return data.correctAnswer;
    }
    if (typeof session.expectedResult === "string" && session.expectedResult.length) {
      return session.expectedResult;
    }
    if (typeof session.result === "string" && session.result.length) {
      return session.result;
    }
    if (typeof session.answer === "string" && session.answer.length) {
      return session.answer;
    }
    if (typeof session.correct_answer === "string" && session.correct_answer.length) {
      return session.correct_answer;
    }
    if (typeof session.correctAnswer === "string" && session.correctAnswer.length) {
      return session.correctAnswer;
    }
    return null;
  };

  const getSupportFiles = () => normalizeSupportFiles()
    .filter((file) => !(file.name.includes("..") || file.name.startsWith("/") || file.name.startsWith("\\")));

  const withTimeout = async (promise, timeoutMs, message) => {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const parseJavaEntry = (code) => {
    const packageMatch = String(code || "").match(/^\s*package\s+([A-Za-z_][\w.]*)\s*;/m);
    const packageName = packageMatch ? packageMatch[1] : "";
    const classMatch =
      String(code || "").match(/\bpublic\s+class\s+([A-Za-z_][\w]*)\b/) ||
      String(code || "").match(/\bclass\s+([A-Za-z_][\w]*)\b/);

    if (!classMatch) {
      throw new Error("Java code must contain a class definition.");
    }

    const className = classMatch[1];
    return {
      sourcePath: `/str/${className}.java`,
      mainClass: javaRuntimeConfig.mainClass || (packageName ? `${packageName}.${className}` : className),
    };
  };

  const runJavaWithCheerpj = async (mainCode) => {
    await initCheerpj();
    await ensureJavaCompiler();

    const runMain = window.cheerpjRunMain;
    if (typeof runMain !== "function") {
      throw new Error("CheerpJ run API not found (expected cheerpjRunMain).");
    }

    if (javaCompileEl) {
      javaCompileEl.textContent = "";
    }
    if (javaDisplayEl) {
      javaDisplayEl.textContent = "";
    }

    const classPath = "/app/tools.jar:/files/";
    const addFileFunc = window.cheerpjAddStringFile || window.cheerpOSAddStringFile;
    if (!addFileFunc || typeof addFileFunc !== "function") {
      throw new Error("CheerpJ source file API not available.");
    }

    const findBlockEnd = (text, openBraceIndex) => {
      let depth = 0;
      for (let i = openBraceIndex; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "{") depth += 1;
        if (ch === "}") {
          depth -= 1;
          if (depth === 0) return i;
        }
      }
      return -1;
    };

    const buildMainWithResultPrint = (sourceCode) => {
      const codeText = String(sourceCode || "");
      const mainMatch = codeText.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{/);
      if (!mainMatch) {
        return null;
      }

      const openBraceIndex = mainMatch.index + mainMatch[0].length - 1;
      const closeBraceIndex = findBlockEnd(codeText, openBraceIndex);
      if (closeBraceIndex < 0) {
        return null;
      }

      const mainBody = codeText.slice(openBraceIndex + 1, closeBraceIndex);
      if (/System\.out\.print(?:ln)?\s*\(/.test(mainBody)) {
        return null;
      }
      if (!/\bresult\b/.test(mainBody)) {
        return null;
      }

      const beforeClose = codeText.slice(0, closeBraceIndex);
      const lineStart = beforeClose.lastIndexOf("\n") + 1;
      const closingIndentMatch = beforeClose.slice(lineStart).match(/^\s*/);
      const closingIndent = closingIndentMatch ? closingIndentMatch[0] : "";
      const statementIndent = `${closingIndent}  `;
      const injectedLine = `\n${statementIndent}System.out.println(result);`;

      return `${beforeClose}${injectedLine}${codeText.slice(closeBraceIndex)}`;
    };

    const executeJavaProgram = async (sourceCode) => {
      const entry = parseJavaEntry(sourceCode);
      if (javaCompileEl) {
        javaCompileEl.textContent = "";
      }
      if (javaDisplayEl) {
        javaDisplayEl.textContent = "";
      }

      addFileFunc(entry.sourcePath, new TextEncoder().encode(String(sourceCode || "")));

      const runWithTimeout = (promise) => withTimeout(
        promise,
        javaRuntimeConfig.timeoutMs,
        `Java run timed out after ${javaRuntimeConfig.timeoutMs}ms`
      );

      const compileExit = await runWithTimeout(
        Promise.resolve(
          runMain(
            "com.sun.tools.javac.Main",
            classPath,
            entry.sourcePath,
            "-d",
            "/files/",
            "-Xlint"
          )
        )
      );

      const compileExitCode = Number.isFinite(Number(compileExit)) ? Number(compileExit) : 0;
      if (compileExitCode !== 0) {
        const compileOutput = getJavaOutputText();
        throw new Error(compileOutput || `javac exited with code ${compileExitCode}`);
      }

      const runExit = await runWithTimeout(
        Promise.resolve(runMain(entry.mainClass, classPath))
      );

      const runExitCode = Number.isFinite(Number(runExit)) ? Number(runExit) : 0;
      if (runExitCode !== 0) {
        const runOutput = getJavaOutputText();
        throw new Error(runOutput || `java exited with code ${runExitCode}`);
      }

      return getJavaOutputText();
    };

    const started = performance.now();
    let outputText = await executeJavaProgram(mainCode);
    if (!String(outputText || "").trim()) {
      const fallbackCode = buildMainWithResultPrint(mainCode);
      if (fallbackCode) {
        outputText = await executeJavaProgram(fallbackCode);
      }
    }

    return {
      expectedResult: outputText || "(no output)",
      durationMs: performance.now() - started,
    };
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
    if (!isPythonMode) {
      if (isJavaMode && javaRuntimeConfig.executionMode === "cheerpj") {
        return runJavaWithCheerpj(code);
      }
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

      // Keep grading UI stable even if telemetry/storage fails.
      try {
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
      } catch (eventErr) {
        console.warn("[jstracing] grade event send failed:", eventErr);
      }

      try {
        // Persist: answer + expected + verdict
        await saveSession(code, expectedResult);
      } catch (saveErr) {
        console.warn("[jstracing] save session failed:", saveErr);
      }

      setStatus("Submitted", "ready");
    } catch (err) {
      const errorText = err && err.message ? err.message : String(err);
      lastExpectedResult = "";
      const isCompileError = /^compile error\s*:/i.test(errorText)
        || /\bjavac\b/i.test(errorText);
      const label = isCompileError ? "Compile Error" : "Runtime Error";
      const cleanedErrorText = String(errorText)
        .replace(/^compile error\s*:\s*/i, "")
        .replace(/^runtime error\s*:\s*/i, "")
        .trim();
      resultEl.textContent = `${label}: ${cleanedErrorText}`;
      resultEl.className = "result-value error";

      // Even on failure, send a grade event with points=0 for observability
      try {
        await sendAcosEvent("grade", {
          attemptId,
          points: 0,
          max_points: 1,
          verdict: "Error",
          answer: answerEl.value || "",
          expectedResult: "",
          errorMessage: errorText,
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
      } catch (eventErr) {
        console.warn("[jstracing] error grade event send failed:", eventErr);
      }

      try {
        await saveSession(code, errorText);
      } catch (saveErr) {
        console.warn("[jstracing] error session save failed:", saveErr);
      }

      setStatus(label, "error");
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
  } else if (isJavaMode && javaRuntimeConfig.executionMode === "cheerpj") {
    initCheerpj().catch((err) => {
      console.error("CheerpJ init failed:", err);
      const msg = err && err.message ? err.message : "Java runtime load failed";
      setStatus(`Java runtime load failed: ${msg}`.slice(0, 140), "error");
    });
  } else {
    setStatus("Java mode: Submit uses built-in expectedResult", "ready");
  }
})();