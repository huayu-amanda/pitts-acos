// acos-jstracing-type/fetch-quiz.js
"use strict";

const http = require('http');
const https = require('https');

let lastFetchQuizDiagnostic = null;

function setLastFetchQuizDiagnostic(diag) {
  lastFetchQuizDiagnostic = diag || null;
}

function getLastFetchQuizDiagnostic() {
  return lastFetchQuizDiagnostic;
}

function normalizeEnvValue(value) {
  if (typeof value !== 'string') return value;
  // Trim whitespace and remove trailing CR (Windows line endings)
  let v = value.trim().replace(/\r$/, '');
  // Strip surrounding quotes if present
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function readEnvFile(envPath) {
  const fs = require('fs');
  const env = {};
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const val = normalizeEnvValue(trimmed.slice(eq + 1));
    env[key] = val;
  });
  return env;
}

function parseIntMaybe(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function getMinMaxFromQuiz(quizObj) {
  if (!quizObj || typeof quizObj !== 'object') return { min: null, max: null };
  const min =
    parseIntMaybe(quizObj.MinVar) ??
    parseIntMaybe(quizObj.minVar) ??
    parseIntMaybe(quizObj.min) ??
    null;
  const max =
    parseIntMaybe(quizObj.MaxVar) ??
    parseIntMaybe(quizObj.maxVar) ??
    parseIntMaybe(quizObj.max) ??
    null;
  return { min, max };
}

function pickRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function evaluateNumericExpression(expr) {
  const trimmed = String(expr || '').trim();
  if (!trimmed) throw new Error('empty expression in _eval()');
  if (!/^[0-9+\-*/%().\s]+$/.test(trimmed)) {
    throw new Error(`unsafe expression in _eval(): ${trimmed}`);
  }
  // Expression is restricted to numeric operators and parentheses only.
  const value = Function(`"use strict"; return (${trimmed});`)();
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`non-finite expression result in _eval(): ${trimmed}`);
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function replaceEvalExpressions(code) {
  let text = code;
  let evalCount = 0;
  const errors = [];

  // Resolve from right to left so nested _eval(...) are handled safely.
  for (let pass = 0; pass < 200; pass += 1) {
    const start = text.lastIndexOf('_eval(');
    if (start < 0) break;

    let depth = 1;
    let end = -1;
    for (let i = start + 6; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end < 0) {
      errors.push('unbalanced _eval(...) expression');
      break;
    }

    const expr = text.slice(start + 6, end);
    try {
      const result = evaluateNumericExpression(expr);
      text = `${text.slice(0, start)}${result}${text.slice(end + 1)}`;
      evalCount += 1;
    } catch (e) {
      errors.push(e && e.message ? e.message : String(e));
      break;
    }
  }

  return { code: text, evalCount, errors };
}

function instantiatePlaceholders(code, quizObj) {
  if (typeof code !== 'string') {
    return {
      code,
      mapping: {},
      range: null,
      evalCount: 0,
      hasParamToken: false,
      errors: [],
    };
  }

  // Find ${NAME} placeholders and legacy _Param token.
  const placeholderRe = /\$\{([A-Za-z0-9_]+)\}/g;
  const names = new Set();
  let m;
  while ((m = placeholderRe.exec(code)) !== null) {
    if (m[1]) names.add(m[1]);
  }
  const hasParamToken = /\b_Param\b/.test(code);
  const hasEvalToken = code.includes('_eval(');

  if (names.size === 0 && !hasParamToken && !hasEvalToken) {
    return {
      code,
      mapping: {},
      range: null,
      evalCount: 0,
      hasParamToken: false,
      errors: [],
    };
  }

  // Range comes from MinVar/MaxVar in backend JSON.
  // If absent/invalid, fall back to a safe default.
  let { min, max } = getMinMaxFromQuiz(quizObj);
  if (min === null) min = 1;
  if (max === null) max = 10;
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }

  const mapping = {};
  for (const name of names) {
    const value = pickRandomInt(min, max);
    mapping[name] = value;
  }
  if (hasParamToken) {
    mapping._Param = pickRandomInt(min, max);
  }

  let instantiated = code.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_full, name) => {
    if (Object.prototype.hasOwnProperty.call(mapping, name)) return String(mapping[name]);
    return _full;
  });

  if (hasParamToken) {
    instantiated = instantiated.replace(/\b_Param\b/g, String(mapping._Param));
  }

  const evalResult = replaceEvalExpressions(instantiated);

  return {
    code: evalResult.code,
    mapping,
    range: { min, max },
    evalCount: evalResult.evalCount,
    hasParamToken,
    errors: evalResult.errors,
  };
}

function normalizeRole(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function shouldInstantiateFetchedQuizPlaceholders(options) {
  const resolved = options && typeof options === 'object' ? options : {};
  if (resolved.forceKeepPlaceholders === true) return false;
  if (resolved.forceInstantiate === true) return true;

  const role = normalizeRole(resolved.role);
  if (role === 'admin' || role === 'superuser') return false;
  if (role === 'user') return true;

  if (typeof resolved.defaultValue === 'boolean') return resolved.defaultValue;
  return true;
}

function extractQuizData(parsed) {
  const contentArr = (parsed && parsed.content && Array.isArray(parsed.content)) ? parsed.content : null;
  if (contentArr && contentArr.length > 0) {
    const quizObj = contentArr[0];
    if (quizObj && quizObj.code) {
      let codeStr = null;
      if (typeof quizObj.code === 'string') codeStr = quizObj.code;
      else if (typeof quizObj.code === 'object' && quizObj.code.toString) codeStr = quizObj.code.toString();
      if (typeof codeStr === 'string') {
        return { quizObj, code: codeStr };
      }
    }
    return { quizObj, code: null };
  }

  if (parsed && (parsed.quizId || parsed.code || parsed.rdfId)) {
    const quizObj = parsed;
    if (quizObj.code) {
      let codeStr = null;
      if (typeof quizObj.code === 'string') codeStr = quizObj.code;
      else if (typeof quizObj.code === 'object' && quizObj.code.toString) codeStr = quizObj.code.toString();
      if (typeof codeStr === 'string') {
        return { quizObj, code: codeStr };
      }
    }
    return { quizObj, code: null };
  }

  return null;
}

function httpRequest(method, urlStr, postData, headers, maxRedirects = 5, cookieJar = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const lib = urlObj.protocol === 'https:' ? https : http;
      const opts = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: method,
        headers: Object.assign({}, headers || {})
      };
      // attach cookies from jar
      const cookieHeader = Object.keys(cookieJar).map(k => `${k}=${cookieJar[k]}`).join('; ');
      if (cookieHeader) opts.headers['Cookie'] = cookieHeader;

      const req = lib.request(opts, (res) => {
        let data = '';
        res.setEncoding('utf8');
        // collect set-cookie into jar
        const setCookie = res.headers['set-cookie'];
        if (setCookie && setCookie.length) {
          setCookie.forEach(c => {
            const parts = c.split(';')[0].split('=');
            if (parts.length>=2) cookieJar[parts[0]] = parts.slice(1).join('=');
          });
        }

        // handle redirects
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && maxRedirects>0) {
          const nextUrl = new URL(res.headers.location, urlStr).toString();
          // follow redirect
          // Browser-like behavior: for 301/302/303 after POST, switch to GET.
          // Keep method for 307/308.
          let nextMethod = method;
          if ([301,302,303].includes(res.statusCode) && method && method.toUpperCase() === 'POST') {
            nextMethod = 'GET';
          } else if (res.statusCode === 303) {
            nextMethod = 'GET';
          }
          // drain body then follow
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve(httpRequest(nextMethod, nextUrl, null, headers, maxRedirects-1, cookieJar));
          });
          return;
        }

        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({statusCode: res.statusCode, headers: res.headers, body: data, cookieJar}));
      });
      req.on('error', (e) => reject(e));
      if (postData) req.write(postData);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Try to fetch quiz code from QuizPetAuthoring.
 * Reads auth and base URL from environment if not provided.
 * Returns the code string on success, or null on failure.
 */
async function tryFetchQuizData(quizId, baseUrl, options) {
  if (!quizId) return null;
  setLastFetchQuizDiagnostic({
    kind: 'start',
    quizId: String(quizId)
  });
  options = options || {};
  const loginMode = (options.loginMode || 'compat').toLowerCase();
  const QUIZPET_BASE_URL = (baseUrl || process.env.QUIZPET_BASE_URL) || 'http://host.docker.internal:8080/quizpet';
  try {
    const cookieJar = {};
    let username = options.username || process.env.QUIZPET_USERNAME;
    let password = options.password || process.env.QUIZPET_PASSWORD;
    let credsSource = {
      username: options.username ? 'options' : (username ? 'process.env' : null),
      password: options.password ? 'options' : (password ? 'process.env' : null),
    };

    // If env vars are missing, probe common local env files.
    if (!username || !password) {
      try {
        const path = require('path');
        const fs = require('fs');
        const envCandidates = [
          path.join(process.cwd(), '.env'),
          path.join(__dirname, '.env'),
          path.join(__dirname, '..', '.env'),
          path.join(__dirname, '..', '..', '.env')
        ];

        for (const envPath of envCandidates) {
          if (!fs.existsSync(envPath)) {
            continue;
          }
          const env = readEnvFile(envPath);
          if (!username && env.QUIZPET_USERNAME) {
            username = env.QUIZPET_USERNAME;
            credsSource.username = envPath;
          }
          if (!password && env.QUIZPET_PASSWORD) {
            password = env.QUIZPET_PASSWORD;
            credsSource.password = envPath;
          }
          if (username && password) {
            break;
          }
        }
      } catch (e) {
        // ignore file read errors
      }
    }

    // Safe diagnostics: do not print secret values.
    // This helps explain cases where shell prompt shows a trailing '%', which is often NOT part of the file.
    const passwordLen = (typeof password === 'string') ? password.length : 0;
    const passwordHasPercent = (typeof password === 'string') ? password.includes('%') : false;
    const passwordHasWhitespace = (typeof password === 'string') ? /\s/.test(password) : false;
    const passwordLastCharCode = (typeof password === 'string' && password.length)
      ? password.charCodeAt(password.length - 1)
      : null;
    console.info('[jstracing][fetch_quiz] INFO: creds resolved', {
      usernamePresent: !!username,
      passwordPresent: !!password,
      usernameSource: credsSource.username,
      passwordSource: credsSource.password,
      passwordLen,
      passwordHasPercent,
      passwordHasWhitespace,
      passwordLastCharCode,
    });

    if (username && password) {
      try {
        // First GET the login page to establish initial cookies and capture any hidden form fields (CSRF tokens)
        const loginPageUrl = QUIZPET_BASE_URL.replace(/\/$/, '') + '/login';
        console.info('[jstracing][fetch_quiz] INFO: GET login page', loginPageUrl);
        const loginPageRes = await httpRequest('GET', loginPageUrl, null, {'Accept':'text/html'}, 5, cookieJar);
        // IMPORTANT: do NOT trust the login page <form action>.
        // In this app it may include URL rewriting like `;jsessionid=...`, which can cause 405 for POST.
        // Always POST to the stable Spring Security endpoint.
        const loginPostUrl = QUIZPET_BASE_URL.replace(/\/$/, '') + '/j_spring_security_check';

        // pitts mode follows the verified curl workflow exactly: cookie + username/password only.
        // compat mode keeps the previous broad form-field strategy for local deployments.
        const formFields = {};
        if (loginMode === 'cookie-username-password') {
          formFields['username'] = username;
          formFields['password'] = password;
        } else {
          const loginBody = (loginPageRes && loginPageRes.body) ? loginPageRes.body : '';
          const hiddenFields = {};
          try {
            const inputRe = /<input[^>]*type=["']hidden["'][^>]*>/gi;
            let match;
            while ((match = inputRe.exec(loginBody)) !== null) {
              const nameMatch = match[0].match(/name=["']([^"']+)["']/i);
              const valMatch = match[0].match(/value=["']([^"']*)["']/i);
              if (nameMatch) hiddenFields[nameMatch[1]] = valMatch ? valMatch[1] : '';
            }
          } catch (e) {
            // ignore parse errors
          }

          Object.keys(hiddenFields).forEach((k) => {
            formFields[k] = hiddenFields[k];
          });
          formFields['j_username'] = username;
          formFields['j_password'] = password;
          formFields['username'] = username;
          formFields['password'] = password;
        }

        const params = new URLSearchParams();
        Object.keys(formFields).forEach(k => params.append(k, formFields[k]));
        const formStr = params.toString();
        console.info('[jstracing][fetch_quiz] INFO: POST login to', loginPostUrl, '(forced, ignoring form action)', 'mode=', loginMode, 'with fields', Object.keys(formFields));
        const loginRes = await httpRequest('POST', loginPostUrl, formStr, {'Content-Type':'application/x-www-form-urlencoded'}, 5, cookieJar);
        console.info('[jstracing][fetch_quiz] INFO: login response', loginRes && loginRes.statusCode);
        if (loginRes && loginRes.headers) {
          console.info('[jstracing][fetch_quiz] INFO: login response content-type', loginRes.headers['content-type'] || null);
          console.info('[jstracing][fetch_quiz] INFO: login response location', loginRes.headers.location || null);
        }
        console.info('[jstracing][fetch_quiz] INFO: cookie jar keys after login', Object.keys(cookieJar || {}));
        if (loginRes && typeof loginRes.body === 'string') {
          const looksLikeLoginPage = /Quizpet\s*-\s*Sign\s*In/i.test(loginRes.body) || /j_spring_security_check/i.test(loginRes.body);
          console.info('[jstracing][fetch_quiz] INFO: login appears successful=', !looksLikeLoginPage);
        }
        if (loginRes && loginRes.body && loginRes.body.length>0) {
          console.debug('[jstracing][fetch_quiz] DEBUG: login response snippet:', loginRes.body.substring(0,500));
        }
      } catch (e) {
        console.warn('[jstracing][fetch_quiz] WARN: login attempt failed:', e && e.message ? e.message : e);
      }
    }

    const quizUrl = QUIZPET_BASE_URL.replace(/\/$/, '') + '/quiz/id/' + quizId;
    let quizRes = null;
    try {
      console.info('[jstracing][fetch_quiz] INFO: GET quiz URL', quizUrl);
      quizRes = await httpRequest('GET', quizUrl, null, {'Accept':'application/json, text/plain, */*'}, 5, cookieJar);
      console.info('[jstracing][fetch_quiz] INFO: quiz response status', quizRes && quizRes.statusCode);
      if (quizRes && quizRes.headers) {
        console.info('[jstracing][fetch_quiz] INFO: quiz response content-type', quizRes.headers['content-type'] || null);
        console.info('[jstracing][fetch_quiz] INFO: quiz response location', quizRes.headers.location || null);
      }
    } catch (e) {
      console.warn('[jstracing][fetch_quiz] WARN: request failed for quizUrl', quizUrl, e && e.message ? e.message : e);
      setLastFetchQuizDiagnostic({
        kind: 'network-error',
        quizId: String(quizId),
        message: e && e.message ? e.message : String(e || 'Unknown network error')
      });
      return null;
    }
    // Accept a successful 2xx with JSON body, or fallback to parse body anyway
    if (!quizRes || typeof quizRes.body !== 'string') {
      console.warn('[jstracing][fetch_quiz] WARN: empty response body for quizId', quizId);
      setLastFetchQuizDiagnostic({
        kind: 'empty-response',
        quizId: String(quizId),
        statusCode: quizRes && quizRes.statusCode ? quizRes.statusCode : null
      });
      return null;
    }
    const quizResContentType = quizRes && quizRes.headers ? (quizRes.headers['content-type'] || '') : '';
    const quizResBodySnippet = (quizRes.body || '').substring(0, 300);
    // try parse JSON
    let parsed = null;
    try {
      parsed = JSON.parse(quizRes.body);
    } catch (e) {
      // not JSON -- log and return null
      console.warn('[jstracing][fetch_quiz] WARN: response not JSON for quizId', quizId);
      console.debug('[jstracing][fetch_quiz] DEBUG: response headers:', quizRes.headers);
      console.debug('[jstracing][fetch_quiz] DEBUG: response body snippet:', (quizRes.body||'').substring(0,200));
      setLastFetchQuizDiagnostic({
        kind: 'non-json',
        quizId: String(quizId),
        statusCode: quizRes.statusCode || null,
        contentType: quizResContentType || null,
        bodySnippet: quizResBodySnippet
      });
      return null;
    }

    if (parsed && parsed.success === false && typeof parsed.message === 'string' && /no such quiz id/i.test(parsed.message)) {
      setLastFetchQuizDiagnostic({
        kind: 'no-such-quiz-id',
        quizId: String(quizId),
        statusCode: quizRes.statusCode || null,
        contentType: quizResContentType || null,
        message: parsed.message
      });
      return null;
    }

    const quizData = extractQuizData(parsed);
    if (quizData && typeof quizData.code === 'string') {
      setLastFetchQuizDiagnostic({
        kind: 'success',
        quizId: String(quizId),
        statusCode: quizRes.statusCode || null,
        contentType: quizResContentType || null
      });
      return quizData;
    }

    if (quizData) {
      console.info('[jstracing][fetch_quiz] INFO: content found but no code property for quizId', quizId);
      return null;
    }

    // As a final fallback, log the parsed structure for debugging
    console.warn('[jstracing][fetch_quiz] WARN: parsed response did not contain code for quizId', quizId, 'parsedKeys=', Object.keys(parsed || {}));
    setLastFetchQuizDiagnostic({
      kind: 'json-without-code',
      quizId: String(quizId),
      statusCode: quizRes.statusCode || null,
      contentType: quizResContentType || null,
      parsedKeys: Object.keys(parsed || {})
    });
    return null;
  } catch (e) {
    console.warn('[jstracing][fetch_quiz] ERROR fetching quiz:', e && e.message ? e.message : e);
    setLastFetchQuizDiagnostic({
      kind: 'unexpected-error',
      quizId: String(quizId),
      message: e && e.message ? e.message : String(e || 'Unknown error')
    });
    return null;
  }
}

async function tryFetchQuizCode(quizId, baseUrl, options) {
  const quizData = await tryFetchQuizData(quizId, baseUrl, options);
  return quizData && typeof quizData.code === 'string' ? quizData.code : null;
}

module.exports = {
  tryFetchQuizCode,
  tryFetchQuizData,
  instantiatePlaceholders,
  shouldInstantiateFetchedQuizPlaceholders,
  getLastFetchQuizDiagnostic,
};
