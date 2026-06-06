/* ============================================================
   CODEPROCT — API.JS
   Frontend API client — replaces mock data with real backend
   calls when server.js is running.
   Include this AFTER config.js in production builds.
   ============================================================ */

const API = (() => {
  const BASE = window.location.origin;  // same-origin API

  let _studentToken = null;
  let _adminToken   = null;

  /* ── TOKEN MANAGEMENT ────────────────────────────────── */
  function setStudentToken(t) { _studentToken = t; Utils.saveLocal('studentToken', t); }
  function setAdminToken(t)   { _adminToken   = t; Utils.saveLocal('adminToken',   t); }
  function getStudentToken()  { return _studentToken || Utils.loadLocal('studentToken'); }
  function getAdminToken()    { return _adminToken   || Utils.loadLocal('adminToken');   }

  /* ── HTTP HELPERS ────────────────────────────────────── */
  async function _request(method, path, body = null, token = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
    const res = await fetch(`${BASE}/api${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  const get  = (path, token) => _request('GET',    path, null, token);
  const post = (path, body, token) => _request('POST', path, body, token);
  const put  = (path, body, token) => _request('PUT',  path, body, token);
  const del  = (path, token) => _request('DELETE', path, null, token);

  /* ── ADMIN AUTH ──────────────────────────────────────── */
  async function adminLogin(email, password) {
    const data = await post('/admin/login', { email, password });
    setAdminToken(data.token);
    return data;
  }

  function adminLogout() {
    _adminToken = null;
    Utils.clearLocal('adminToken');
  }

  /* ── STUDENT REGISTRATION ────────────────────────────── */
  async function studentRegister({ name, usn, phone, email, googleEmail, googleSub, ip }) {
    const data = await post('/student/register', {
      name, usn, phone, email, googleEmail, googleSub, ip,
      userAgent: navigator.userAgent,
    });
    setStudentToken(data.token);
    return data;
  }

  /* ── STUDENT TEST APIS ───────────────────────────────── */
  async function getQuestions() {
    return get('/student/questions', getStudentToken());
  }

  async function getTestConfig() {
    return get('/student/config', getStudentToken());
  }

  async function saveAnswer(questionId, lang, code) {
    return post('/student/answer/save', { questionId, lang, code }, getStudentToken());
  }

  async function recordViolation(reason) {
    return post('/student/violation', { reason }, getStudentToken());
  }

  async function submitTest({ answers, timeTakenSec, primaryLang }) {
    return post('/student/submit', { answers, timeTakenSec, primaryLang }, getStudentToken());
  }

  /* ── CODE EXECUTION (via server proxy) ──────────────── */
  async function executeCode(sourceCode, lang, stdin = '') {
    const langIds = { python: 71, java: 62, cpp: 54 };
    const data = await post('/execute/submit', {
      source_code: btoa(unescape(encodeURIComponent(sourceCode))),
      language_id: langIds[lang],
      stdin: btoa(unescape(encodeURIComponent(stdin))),
    }, getStudentToken());
    return data.token;
  }

  async function getExecutionResult(token) {
    return get(`/execute/result/${token}`, getStudentToken());
  }

  async function executeAndPoll(sourceCode, lang, stdin = '') {
    const token = await executeCode(sourceCode, lang, stdin);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const result = await getExecutionResult(token);
      if (result.status?.id > 2) return result;
    }
    throw new Error('Execution timed out');
  }

  /* ── ADMIN APIS ──────────────────────────────────────── */
  async function getDashboard() {
    return get('/admin/dashboard', getAdminToken());
  }

  async function getStudents() {
    return get('/admin/students', getAdminToken());
  }

  async function getResults() {
    return get('/admin/results', getAdminToken());
  }

  async function getAdminQuestions() {
    return get('/admin/questions', getAdminToken());
  }

  async function createQuestion(q) {
    return post('/admin/questions', q, getAdminToken());
  }

  async function updateQuestion(id, q) {
    return put(`/admin/questions/${id}`, q, getAdminToken());
  }

  async function deleteQuestion(id) {
    return del(`/admin/questions/${id}`, getAdminToken());
  }

  async function getAdminConfig() {
    return get('/admin/config', getAdminToken());
  }

  async function updateAdminConfig(cfg) {
    return put('/admin/config', cfg, getAdminToken());
  }

  async function getViolations(sessionId) {
    return get(`/admin/violations/${sessionId}`, getAdminToken());
  }

  async function terminateSession(sessionId, reason = '') {
    return post(`/admin/terminate/${sessionId}`, { reason }, getAdminToken());
  }

  function exportResultsUrl() {
    return `${BASE}/api/admin/export/results?token=${getAdminToken()}`;
  }

  async function uploadExcel(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/api/admin/upload/excel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAdminToken()}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  /* ── SOCKET.IO REAL-TIME ─────────────────────────────── */
  function connectAdminSocket(handlers = {}) {
    if (typeof io === 'undefined') { console.warn('Socket.IO not loaded'); return; }
    const socket = io(BASE);
    socket.emit('admin:join', getAdminToken());

    if (handlers.onStudentJoined)   socket.on('student:joined',    handlers.onStudentJoined);
    if (handlers.onStudentViolation) socket.on('student:violation', handlers.onStudentViolation);
    if (handlers.onStudentSubmitted) socket.on('student:submitted', handlers.onStudentSubmitted);
    if (handlers.onHeartbeat)        socket.on('student:heartbeat', handlers.onHeartbeat);
    return socket;
  }

  function connectStudentSocket(sessionToken, handlers = {}) {
    if (typeof io === 'undefined') return;
    const socket = io(BASE);
    socket.emit('student:identify', sessionToken);

    setInterval(() => {
      socket.emit('student:heartbeat', {
        sessionId: Utils.loadLocal('sessionId'),
        timeLeft:  Test?.state?.timeLeft || 0,
      });
    }, 30000);

    if (handlers.onTerminated) socket.on('test:terminated', handlers.onTerminated);
    return socket;
  }

  return {
    // Auth
    adminLogin, adminLogout, studentRegister,
    // Student
    getQuestions, getTestConfig, saveAnswer, recordViolation, submitTest,
    // Execution
    executeCode, getExecutionResult, executeAndPoll,
    // Admin
    getDashboard, getStudents, getResults,
    getAdminQuestions, createQuestion, updateQuestion, deleteQuestion,
    getAdminConfig, updateAdminConfig,
    getViolations, terminateSession,
    exportResultsUrl, uploadExcel,
    // Sockets
    connectAdminSocket, connectStudentSocket,
    // Token
    getStudentToken, getAdminToken,
  };
})();

/* ────────────────────────────────────────────────────────────
   INTEGRATION GUIDE
   ─────────────────────────────────────────────────────────────

   To switch from demo mode to live backend:

   1. Add this script AFTER config.js in index.html:
      <script src="js/api.js"></script>

   2. In auth.js → _onGoogleSuccess(), replace the mock login:
      const data = await API.studentRegister({ name, usn, ... });
      // data.token is auto-saved by API module

   3. In test.js → start(), load questions from server:
      const { questions } = await API.getQuestions();
      App.state.questions = questions;

   4. In test.js → _recordViolation(), post to server:
      await API.recordViolation(reason);

   5. In test.js → submit(), send to server:
      const result = await API.submitTest({ answers, timeTakenSec, primaryLang });

   6. In admin.js → init(), load live data:
      const { students } = await API.getStudents();
      const socket = API.connectAdminSocket({
        onStudentJoined:    s => updateStudentRow(s),
        onStudentViolation: v => flashViolation(v),
        onStudentSubmitted: r => updateResultRow(r),
      });

   7. In admin.js → _renderUpload() file handler:
      const result = await API.uploadExcel(file);

   8. Results Excel download button:
      window.open(API.exportResultsUrl(), '_blank');
   ──────────────────────────────────────────────────────────── */
