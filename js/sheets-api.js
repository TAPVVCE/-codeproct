/* ============================================================
   CODEPROCT — sheets-api.js
   Frontend Google Sheets API client.
   Replaces server.js — all data goes directly to Google Sheets
   via the deployed Apps Script Web App URL.

   HOW TO USE:
   1. Deploy Code.gs as a Web App (see README-SHEETS.md)
   2. Paste the Web App URL into SHEETS_CONFIG below
   3. Include this file BEFORE all other JS in index.html
   ============================================================ */

const SHEETS_CONFIG = {
  // ── Paste your Apps Script Web App URL here ──────────────
  // Example: https://script.google.com/macros/s/AKfy.../exec
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbyiyoJquqN3VXy76bY4blNMAuHfUqHD8TpArX7odPeOf7lny9u3AZniBXeLCW6KNMbs7w/exec',

  // ── Google OAuth Client ID ────────────────────────────────
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',

  // ── Judge0 for code execution (optional) ─────────────────
  JUDGE0_URL: 'https://judge0-ce.p.rapidapi.com',
  JUDGE0_KEY: '',   // paste your RapidAPI key here
};

/* ────────────────────────────────────────────────────────────
   SheetsAPI — all calls to Google Sheets backend
   ────────────────────────────────────────────────────────── */
const SheetsAPI = (() => {
  const BASE = SHEETS_CONFIG.WEB_APP_URL;

  let _studentToken = null;
  let _adminToken   = null;

  /* ── TOKEN HELPERS ──────────────────────────────────────── */
  function setStudentToken(t) { _studentToken = t; try { localStorage.setItem('cp_studentToken', t); } catch {} }
  function setAdminToken(t)   { _adminToken   = t; try { localStorage.setItem('cp_adminToken',   t); } catch {} }
  function getStudentToken()  { return _studentToken || (() => { try { return localStorage.getItem('cp_studentToken'); } catch { return null; } })(); }
  function getAdminToken()    { return _adminToken   || (() => { try { return localStorage.getItem('cp_adminToken');   } catch { return null; } })(); }
  function clearTokens()      { _studentToken = null; _adminToken = null; try { localStorage.removeItem('cp_studentToken'); localStorage.removeItem('cp_adminToken'); } catch {} }

  /* ── HTTP HELPERS ───────────────────────────────────────── */
  async function _get(params = {}) {
    if (!BASE || BASE === 'YOUR_WEB_APP_URL_HERE') {
      console.warn('[SheetsAPI] Web App URL not configured — using offline mock mode');
      return _mockGet(params);
    }
    const url = new URL(BASE);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res  = await fetch(url.toString());
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Sheets API error');
    return data;
  }

  async function _post(body = {}) {
    if (!BASE || BASE === 'YOUR_WEB_APP_URL_HERE') {
      console.warn('[SheetsAPI] Web App URL not configured — using offline mock mode');
      return _mockPost(body);
    }
    const res  = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for CORS
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Sheets API error');
    return data;
  }

  /* ════════════════════════════════════════════════════════
     ADMIN AUTH
     ════════════════════════════════════════════════════════ */
  async function adminLogin(email, password) {
    const data = await _post({ action: 'adminLogin', email, password });
    setAdminToken(data.token);
    return data;
  }

  function adminLogout() {
    clearTokens();
  }

  /* ════════════════════════════════════════════════════════
     STUDENT REGISTRATION & SESSION
     ════════════════════════════════════════════════════════ */
  async function registerStudent({ name, usn, phone, college_email, google_email, google_sub, ip_address }) {
    const data = await _post({
      action: 'registerStudent',
      name, usn, phone, college_email, google_email, google_sub,
      ip_address,
      device_type: _detectDevice(),
      user_agent:  navigator.userAgent,
    });
    setStudentToken(data.token);
    return data;
  }

  async function startSession() {
    return _post({ action: 'startSession', token: getStudentToken() });
  }

  async function sendHeartbeat(sessionId, timeLeft) {
    return _post({ action: 'heartbeat', token: getStudentToken(), sessionId, timeLeft }).catch(() => {});
  }

  /* ════════════════════════════════════════════════════════
     ANSWERS — auto-save during test
     ════════════════════════════════════════════════════════ */
  async function saveAnswer(sessionId, questionId, questionTitle, language, code) {
    return _post({
      action: 'saveAnswer',
      token:  getStudentToken(),
      sessionId, questionId, questionTitle, language, code,
    });
  }

  /* ════════════════════════════════════════════════════════
     VIOLATIONS
     ════════════════════════════════════════════════════════ */
  async function recordViolation(sessionId, reason) {
    return _post({
      action: 'recordViolation',
      token:  getStudentToken(),
      sessionId, reason,
    });
  }

  /* ════════════════════════════════════════════════════════
     FINAL SUBMISSION
     ════════════════════════════════════════════════════════ */
  async function submitTest({ sessionId, answers, timeTakenSec, primaryLang }) {
    return _post({
      action: 'submitTest',
      token:  getStudentToken(),
      sessionId, answers, timeTakenSec, primaryLang,
    });
  }

  /* ════════════════════════════════════════════════════════
     LOAD QUESTIONS & CONFIG
     ════════════════════════════════════════════════════════ */
  async function getQuestions() {
    const data = await _get({ action: 'getQuestions' });
    return data.questions || [];
  }

  async function getConfig() {
    const data = await _get({ action: 'getConfig' });
    return data.config || {};
  }

  /* ════════════════════════════════════════════════════════
     ADMIN — DASHBOARD, STUDENTS, RESULTS, ANSWERS
     ════════════════════════════════════════════════════════ */
  async function getDashboard() {
    return _get({ action: 'getDashboard', token: getAdminToken() });
  }

  async function getStudents() {
    const data = await _get({ action: 'getStudents', token: getAdminToken() });
    return data.students || [];
  }

  async function getResults() {
    const data = await _get({ action: 'getResults', token: getAdminToken() });
    return data.results || [];
  }

  async function getAnswers(usn = '') {
    const data = await _get({ action: 'getAnswers', token: getAdminToken(), usn });
    return data.answers || [];
  }

  async function saveConfig(config) {
    return _post({ action: 'saveConfig', token: getAdminToken(), config });
  }

  async function uploadQuestions(questions) {
    return _post({ action: 'uploadQuestions', token: getAdminToken(), questions });
  }

  async function terminateSession(sessionId, reason = '') {
    return _post({ action: 'terminateSession', token: getAdminToken(), sessionId, reason });
  }

  /* ════════════════════════════════════════════════════════
     CODE EXECUTION — Judge0
     ════════════════════════════════════════════════════════ */
  const LANG_IDS = { python: 71, java: 62, cpp: 54 };

  async function executeCode(code, lang, stdin = '') {
    if (!SHEETS_CONFIG.JUDGE0_KEY) return _simulateExecution(code, lang, stdin);

    const submitRes = await fetch(`${SHEETS_CONFIG.JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key':  SHEETS_CONFIG.JUDGE0_KEY,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
      },
      body: JSON.stringify({
        language_id: LANG_IDS[lang] || 71,
        source_code: btoa(unescape(encodeURIComponent(code))),
        stdin:       btoa(unescape(encodeURIComponent(stdin))),
      }),
    });
    const { token } = await submitRes.json();

    // Poll for result
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(
        `${SHEETS_CONFIG.JUDGE0_URL}/submissions/${token}?base64_encoded=true`,
        { headers: { 'X-RapidAPI-Key': SHEETS_CONFIG.JUDGE0_KEY, 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' } }
      );
      const result = await pollRes.json();
      if (result.status?.id > 2) {
        const decode = s => s ? decodeURIComponent(escape(atob(s))) : '';
        return {
          stdout:         decode(result.stdout),
          stderr:         decode(result.stderr),
          compile_output: decode(result.compile_output),
          status:         result.status?.description,
          status_id:      result.status?.id,
          time:           result.time,
          memory:         result.memory,
        };
      }
    }
    throw new Error('Execution timed out');
  }

  function _simulateExecution(code, lang, stdin) {
    return new Promise(resolve => {
      setTimeout(() => {
        const lines = stdin.split('\n').map(l => l.trim()).filter(Boolean);
        let stdout = '';
        const isFizz = code.includes('Fizz') || code.includes('fizz');
        const isFib  = code.includes('fib')  || (code.includes('a, b') && code.includes('a + b')) || code.includes('Fibonacci');
        const isPrime = code.includes('Prime') || code.includes('isPrime') || code.includes('is_prime');

        if (isFizz) {
          const n = parseInt(lines[0]) || 15;
          const out = [];
          for (let i = 1; i <= n; i++) {
            if (i % 15 === 0) out.push('FizzBuzz');
            else if (i % 3 === 0) out.push('Fizz');
            else if (i % 5 === 0) out.push('Buzz');
            else out.push(String(i));
          }
          stdout = out.join('\n');
        } else if (isFib) {
          const n = parseInt(lines[0]) || 8;
          let a = 0, b = 1; const r = [];
          for (let i = 0; i < n; i++) { r.push(a); [a, b] = [b, a + b]; }
          stdout = r.join(' ');
        } else if (isPrime) {
          const t = parseInt(lines[0]) || 1;
          const nums = lines.slice(1);
          const ip = n => { if (n <= 1) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
          stdout = nums.slice(0, t).map(n => ip(parseInt(n)) ? 'Prime' : 'Not Prime').join('\n');
        } else {
          stdout = `[Simulated ${lang.toUpperCase()} output]\nAdd JUDGE0_KEY to SHEETS_CONFIG for real execution.`;
        }
        resolve({ stdout, stderr: '', compile_output: '', status: 'Accepted (Simulated)', status_id: 3, simulated: true });
      }, 700);
    });
  }

  /* ════════════════════════════════════════════════════════
     OFFLINE MOCK (when Web App URL not configured)
     ════════════════════════════════════════════════════════ */
  function _mockGet(params) {
    const { action } = params;
    if (action === 'getQuestions') return Promise.resolve({ success: true, questions: _MOCK_QUESTIONS });
    if (action === 'getConfig')    return Promise.resolve({ success: true, config: _MOCK_CONFIG });
    if (action === 'getDashboard') return Promise.resolve({ success: true, total: 10, live: 3, submitted: 6, flagged: 1, avgScore: 22 });
    if (action === 'getStudents')  return Promise.resolve({ success: true, students: _MOCK_STUDENTS });
    if (action === 'getResults')   return Promise.resolve({ success: true, results: _MOCK_RESULTS });
    if (action === 'getAnswers')   return Promise.resolve({ success: true, answers: [] });
    return Promise.resolve({ success: true });
  }

  function _mockPost(body) {
    const { action } = body;
    if (action === 'adminLogin') {
      const cred = _MOCK_ADMINS.find(a => a.email === body.email && a.password === body.password);
      if (cred) { const t = 'mock_admin_token'; setAdminToken(t); return Promise.resolve({ success: true, token: t, name: cred.name, role: cred.role }); }
      return Promise.reject(new Error('Invalid credentials'));
    }
    if (action === 'registerStudent') {
      const t = 'mock_student_' + Date.now(); setStudentToken(t);
      return Promise.resolve({ success: true, token: t, studentId: 'ST' + Date.now(), isNew: true });
    }
    if (action === 'startSession')    return Promise.resolve({ success: true, sessionId: 'SES' + Date.now(), durationSecs: 2700 });
    if (action === 'saveAnswer')      return Promise.resolve({ success: true, saved: true });
    if (action === 'recordViolation') return Promise.resolve({ success: true, recorded: true, terminate: false });
    if (action === 'submitTest') {
      const score = Object.keys(body.answers || {}).length * 10;
      return Promise.resolve({ success: true, totalScore: score, totalMarks: 30, pct: Math.round(score/30*100), rank: score >= 27 ? 'S' : score >= 21 ? 'A' : score >= 15 ? 'B' : 'C', timeFmt: '22m 14s', violations: 0 });
    }
    if (action === 'saveConfig')      return Promise.resolve({ success: true, saved: true });
    if (action === 'uploadQuestions') return Promise.resolve({ success: true, uploaded: (body.questions || []).length });
    if (action === 'terminateSession')return Promise.resolve({ success: true, terminated: true });
    if (action === 'heartbeat')       return Promise.resolve({ success: true });
    return Promise.resolve({ success: true });
  }

  /* ── DEVICE DETECTION ────────────────────────────────── */
  function _detectDevice() {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua))        return 'mobile';
    if (/tablet|ipad/i.test(ua))   return 'tablet';
    return 'desktop';
  }

  /* ── MOCK DATA (offline / demo fallback) ─────────────── */
  const _MOCK_ADMINS = [
    { email: 'admin@test.com', password: 'admin123', name: 'Admin User', role: 'superadmin' },
  ];

  const _MOCK_CONFIG = {
    duration_minutes: '45', video_proctoring: 'TRUE', tab_detection: 'TRUE',
    paste_blocked: 'TRUE', fullscreen_required: 'TRUE', max_violations: '5',
    test_title: 'Coding Assessment 2025', institution_name: 'Demo Institution',
  };

  const _MOCK_QUESTIONS = [
    { id: 1, title: 'FizzBuzz Classic', description: 'Print numbers 1-N with Fizz/Buzz rules.', marks: 10, time_limit_secs: 2, allowed_langs: ['python','java','cpp'], examples: [{input:'5',output:'1\n2\nFizz\n4\nBuzz'}], test_cases: [{input:'5'}] },
    { id: 2, title: 'Fibonacci (Python only)', description: 'Print first N Fibonacci numbers.', marks: 10, time_limit_secs: 2, allowed_langs: ['python'], examples: [{input:'8',output:'0 1 1 2 3 5 8 13'}], test_cases: [{input:'8'}] },
    { id: 3, title: 'Prime Checker', description: 'Check if each number is prime.', marks: 10, time_limit_secs: 3, allowed_langs: ['python','java','cpp'], examples: [{input:'3\n2\n4\n7',output:'Prime\nNot Prime\nPrime'}], test_cases: [{input:'3\n2\n4\n7'}] },
  ];

  const _MOCK_STUDENTS = [
    { name:'Arjun Sharma', usn:'1RV21CS001', college_email:'arjun@rvce.edu.in', ip_address:'103.21.14.10', session_status:'live', violations:1, time_left_secs:2302, primary_lang:'Python' },
    { name:'Priya Nair',   usn:'1RV21CS002', college_email:'priya@rvce.edu.in', ip_address:'103.21.14.11', session_status:'submitted', violations:0, score:24, total_marks:30, rank:'A' },
    { name:'Rahul Verma',  usn:'1RV21CS003', college_email:'rahul@rvce.edu.in', ip_address:'103.21.14.12', session_status:'flagged', violations:4, primary_lang:'C++' },
  ];

  const _MOCK_RESULTS = [
    { student_name:'Priya Nair', student_usn:'1RV21CS002', college_email:'priya@rvce.edu.in', total_score:24, total_marks:30, percentage:'80%', rank:'A', time_taken_fmt:'22m 14s', violations:0, primary_lang:'Java', submitted_at: new Date().toISOString() },
    { student_name:'Sneha Rao',  student_usn:'1RV21CS004', college_email:'sneha@rvce.edu.in', total_score:28, total_marks:30, percentage:'93%', rank:'S', time_taken_fmt:'18m 40s', violations:0, primary_lang:'Python', submitted_at: new Date().toISOString() },
  ];

  return {
    adminLogin, adminLogout,
    registerStudent, startSession, sendHeartbeat,
    saveAnswer, recordViolation, submitTest,
    getQuestions, getConfig,
    getDashboard, getStudents, getResults, getAnswers,
    saveConfig, uploadQuestions, terminateSession,
    executeCode,
    getStudentToken, getAdminToken, clearTokens,
  };
})();
