// lib/jstracing/fetch_quiz.js
"use strict";

const http = require('http');
const https = require('https');

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

function instantiatePlaceholders(code, quizObj) {
  if (typeof code !== 'string') return { code, mapping: {}, range: null };

  // Find ${NAME} placeholders
  const re = /\$\{([A-Za-z0-9_]+)\}/g;
  const names = new Set();
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m[1]) names.add(m[1]);
  }
  if (names.size === 0) return { code, mapping: {}, range: null };

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
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    mapping[name] = value;
  }

  const instantiated = code.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_full, name) => {
    if (Object.prototype.hasOwnProperty.call(mapping, name)) return String(mapping[name]);
    return _full;
  });

  return { code: instantiated, mapping, range: { min, max } };
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
async function tryFetchQuizCode(quizId, baseUrl) {
  if (!quizId) return null;
  const QUIZPET_BASE_URL = (baseUrl || process.env.QUIZPET_BASE_URL) || 'http://host.docker.internal:8080/quizpet';
  try {
    const cookieJar = {};
    let username = process.env.QUIZPET_USERNAME;
    let password = process.env.QUIZPET_PASSWORD;
    let credsSource = {
      username: username ? 'process.env' : null,
      password: password ? 'process.env' : null,
    };

    // If env vars not set, try to read acos-jstracing/.env in package root
    if (!username || !password) {
      try {
        const path = require('path');
        const envPath = path.join(__dirname, '..', '..', '.env');
        const fs = require('fs');
        if (fs.existsSync(envPath)) {
          const env = readEnvFile(envPath);
          if (!username && env.QUIZPET_USERNAME) {
            username = env.QUIZPET_USERNAME;
            credsSource.username = envPath;
          }
          if (!password && env.QUIZPET_PASSWORD) {
            password = env.QUIZPET_PASSWORD;
            credsSource.password = envPath;
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
        const loginBody = (loginPageRes && loginPageRes.body) ? loginPageRes.body : '';
        // extract hidden inputs
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
        // IMPORTANT: do NOT trust the login page <form action>.
        // In this app it may include URL rewriting like `;jsessionid=...`, which can cause 405 for POST.
        // Always POST to the stable Spring Security endpoint.
        const loginPostUrl = QUIZPET_BASE_URL.replace(/\/$/, '') + '/j_spring_security_check';

        // build form fields: include both common Spring names and generic names to maximize compatibility
        const formFields = Object.assign({}, hiddenFields);
        formFields['j_username'] = username;
        formFields['j_password'] = password;
        // also include non-j_ variants in case the form expects them
        formFields['username'] = username;
        formFields['password'] = password;

        const params = new URLSearchParams();
        Object.keys(formFields).forEach(k => params.append(k, formFields[k]));
        const formStr = params.toString();
        console.info('[jstracing][fetch_quiz] INFO: POST login to', loginPostUrl, '(forced, ignoring form action)', 'with fields', Object.keys(formFields));
        const loginRes = await httpRequest('POST', loginPostUrl, formStr, {'Content-Type':'application/x-www-form-urlencoded'}, 5, cookieJar);
        console.info('[jstracing][fetch_quiz] INFO: login response', loginRes && loginRes.statusCode);
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
    } catch (e) {
      console.warn('[jstracing][fetch_quiz] WARN: request failed for quizUrl', quizUrl, e && e.message ? e.message : e);
      return null;
    }
    // Accept a successful 2xx with JSON body, or fallback to parse body anyway
    if (!quizRes || typeof quizRes.body !== 'string') {
      console.warn('[jstracing][fetch_quiz] WARN: empty response body for quizId', quizId);
      return null;
    }
    // try parse JSON
    let parsed = null;
    try {
      parsed = JSON.parse(quizRes.body);
    } catch (e) {
      // not JSON -- log and return null
      console.warn('[jstracing][fetch_quiz] WARN: response not JSON for quizId', quizId);
      console.debug('[jstracing][fetch_quiz] DEBUG: response headers:', quizRes.headers);
      console.debug('[jstracing][fetch_quiz] DEBUG: response body snippet:', (quizRes.body||'').substring(0,200));
      return null;
    }

    // support different response shapes: prefer parsed.content array
    const contentArr = (parsed && parsed.content && Array.isArray(parsed.content)) ? parsed.content : null;
    if (contentArr && contentArr.length>0) {
      const quizObj = contentArr[0];
      // accept code whether string or object with toString
      if (quizObj && quizObj.code) {
        let codeStr = null;
        if (typeof quizObj.code === 'string') codeStr = quizObj.code;
        else if (typeof quizObj.code === 'object' && quizObj.code.toString) codeStr = quizObj.code.toString();
        if (typeof codeStr === 'string') {
          const inst = instantiatePlaceholders(codeStr, quizObj);
          if (inst && inst.range) {
            console.info('[jstracing][fetch_quiz] INFO: instantiated placeholders', {
              range: inst.range,
              placeholders: Object.keys(inst.mapping || {}),
              mapping: inst.mapping,
            });
          }
          return inst.code;
        }
      }
      // no code found but content present
      console.info('[jstracing][fetch_quiz] INFO: content found but no code property for quizId', quizId);
      return null;
    }

    // Some endpoints may return the quiz object directly (not wrapped in content)
    if (parsed && (parsed.quizId || parsed.code || parsed.rdfId)) {
      const quizObj = parsed;
      if (quizObj.code) {
        let codeStr = null;
        if (typeof quizObj.code === 'string') codeStr = quizObj.code;
        else if (typeof quizObj.code === 'object' && quizObj.code.toString) codeStr = quizObj.code.toString();
        if (typeof codeStr === 'string') {
          const inst = instantiatePlaceholders(codeStr, quizObj);
          if (inst && inst.range) {
            console.info('[jstracing][fetch_quiz] INFO: instantiated placeholders', {
              range: inst.range,
              placeholders: Object.keys(inst.mapping || {}),
              mapping: inst.mapping,
            });
          }
          return inst.code;
        }
      }
    }

    // As a final fallback, log the parsed structure for debugging
    console.warn('[jstracing][fetch_quiz] WARN: parsed response did not contain code for quizId', quizId, 'parsedKeys=', Object.keys(parsed || {}));
    return null;
  } catch (e) {
    console.warn('[jstracing][fetch_quiz] ERROR fetching quiz:', e && e.message ? e.message : e);
    return null;
  }
}

module.exports = { tryFetchQuizCode };
