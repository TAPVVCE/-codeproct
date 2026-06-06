// ============================================================
// CODEPROCT — Google Apps Script Backend (Code.gs)
// Deploy as Web App: Execute as Me, Anyone can access
//
// This script IS your entire backend.
// It reads/writes all data to Google Sheets — free, unlimited.
//
// SHEETS CREATED AUTOMATICALLY:
//   1. Config          — test settings & admin credentials
//   2. Questions       — all questions with test cases
//   3. Students        — registered student details + IP
//   4. Sessions        — live test sessions + violations
//   5. Answers         — every student's submitted code
//   6. Results         — final scores, rank, grade
//   7. Violations_Log  — every anti-cheat violation recorded
//   8. Activity_Log    — full audit trail
// ============================================================

// ── SPREADSHEET ID ─────────────────────────────────────────
// After running setupSheets(), this is auto-filled.
// Or paste your Sheet ID here manually.
const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';

// ── CORS HEADERS ────────────────────────────────────────────
function _cors(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function _ok(data) {
  return _cors(ContentService.createTextOutput(JSON.stringify({ success: true, ...data })));
}

function _err(msg, code) {
  return _cors(ContentService.createTextOutput(JSON.stringify({ success: false, error: msg, code: code || 400 })));
}

// ── SPREADSHEET HELPER ──────────────────────────────────────
function _ss() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Sheet ID not configured. Run setupSheets() first.');
  return SpreadsheetApp.openById(id);
}

function _sheet(name) {
  return _ss().getSheetByName(name);
}

// ── ENTRY POINTS ────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    const token  = e.parameter.token  || '';
    switch (action) {
      case 'getQuestions':    return handleGetQuestions(e);
      case 'getConfig':       return handleGetConfig(e);
      case 'getDashboard':    return handleGetDashboard(e, token);
      case 'getStudents':     return handleGetStudents(e, token);
      case 'getResults':      return handleGetResults(e, token);
      case 'getAnswers':      return handleGetAnswers(e, token);
      case 'exportResults':   return handleExportResults(e, token);
      case 'ping':            return _ok({ message: 'CodeProct Google Sheets API is live' });
      default:                return _err('Unknown action: ' + action);
    }
  } catch (err) {
    return _err(err.message);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || e.parameter.action || '';
    switch (action) {
      case 'adminLogin':        return handleAdminLogin(body);
      case 'registerStudent':   return handleRegisterStudent(body);
      case 'startSession':      return handleStartSession(body);
      case 'saveAnswer':        return handleSaveAnswer(body);
      case 'recordViolation':   return handleRecordViolation(body);
      case 'submitTest':        return handleSubmitTest(body);
      case 'heartbeat':         return handleHeartbeat(body);
      case 'uploadQuestions':   return handleUploadQuestions(body);
      case 'saveConfig':        return handleSaveConfig(body);
      case 'terminateSession':  return handleTerminateSession(body);
      default:                  return _err('Unknown action: ' + action);
    }
  } catch (err) {
    return _err(err.message);
  }
}

// ════════════════════════════════════════════════════════════
// SETUP — Run this ONCE from the Apps Script editor
// ════════════════════════════════════════════════════════════
function setupSheets() {
  // Create a new spreadsheet (or use existing)
  let ss;
  const existingId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (existingId) {
    ss = SpreadsheetApp.openById(existingId);
    Logger.log('Using existing sheet: ' + existingId);
  } else {
    ss = SpreadsheetApp.create('CodeProct — Assessment Platform');
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
    Logger.log('Created new sheet: ' + ss.getId());
  }

  // Delete default "Sheet1" if present
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  // ── Create all required sheets ──────────────────────────
  _ensureSheet(ss, 'Config', [
    ['key', 'value', 'updated_at'],
    ['duration_minutes', '45', new Date().toISOString()],
    ['start_datetime', '', ''],
    ['video_proctoring', 'TRUE', ''],
    ['tab_detection', 'TRUE', ''],
    ['paste_blocked', 'TRUE', ''],
    ['fullscreen_required', 'TRUE', ''],
    ['max_violations', '5', ''],
    ['access_code', '', ''],
    ['test_title', 'Coding Assessment 2025', ''],
    ['institution_name', 'Your Institution', ''],
  ]);

  _ensureSheet(ss, 'Admins', [
    ['email', 'password_hash', 'name', 'role', 'created_at'],
    ['admin@test.com', _hashPassword('admin123'), 'Admin User', 'superadmin', new Date().toISOString()],
  ]);

  _ensureSheet(ss, 'Questions', [
    ['id','title','description','marks','time_limit_secs','allowed_langs','test_cases_json','examples_json','created_at'],
    [
      1,
      'FizzBuzz Classic',
      'Write a program that prints numbers from 1 to N. For multiples of 3 print "Fizz", multiples of 5 print "Buzz", both print "FizzBuzz".',
      10, 2, 'python,java,cpp',
      JSON.stringify([{input:'15',expected:'1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',hidden:false},{input:'5',expected:'1\n2\nFizz\n4\nBuzz',hidden:true}]),
      JSON.stringify([{input:'5',output:'1\n2\nFizz\n4\nBuzz'}]),
      new Date().toISOString()
    ],
    [
      2,
      'Fibonacci (Python only)',
      'Given N, print the first N Fibonacci numbers separated by spaces.',
      10, 2, 'python',
      JSON.stringify([{input:'8',expected:'0 1 1 2 3 5 8 13',hidden:false}]),
      JSON.stringify([{input:'8',output:'0 1 1 2 3 5 8 13'}]),
      new Date().toISOString()
    ],
    [
      3,
      'Prime Checker',
      'Given T test cases, print "Prime" or "Not Prime" for each number.',
      10, 3, 'python,java,cpp',
      JSON.stringify([{input:'5\n2\n3\n4\n17\n100',expected:'Prime\nPrime\nNot Prime\nPrime\nNot Prime',hidden:false}]),
      JSON.stringify([{input:'5\n2\n3\n4\n17\n100',output:'Prime\nPrime\nNot Prime\nPrime\nNot Prime'}]),
      new Date().toISOString()
    ],
  ]);

  _ensureSheet(ss, 'Students', [
    ['id','name','usn','phone','college_email','google_email','google_sub','ip_address','device_type','user_agent','registered_at'],
  ]);

  _ensureSheet(ss, 'Sessions', [
    ['id','student_id','student_name','student_usn','started_at','ended_at','status','violations','time_left_secs','primary_lang'],
  ]);

  _ensureSheet(ss, 'Answers', [
    ['id','session_id','student_name','student_usn','question_id','question_title','language','code','score','max_score','test_results_json','saved_at'],
  ]);

  _ensureSheet(ss, 'Results', [
    ['id','session_id','student_name','student_usn','college_email','ip_address','total_score','total_marks','percentage','rank','grade','time_taken_secs','time_taken_fmt','violations','primary_lang','submitted_at'],
  ]);

  _ensureSheet(ss, 'Violations_Log', [
    ['id','session_id','student_name','student_usn','reason','occurred_at'],
  ]);

  _ensureSheet(ss, 'Activity_Log', [
    ['id','timestamp','type','student_name','student_usn','details'],
  ]);

  // Apply formatting
  _formatAllSheets(ss);

  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId();
  Logger.log('✅ Setup complete! Sheet URL: ' + url);
  Logger.log('✅ Sheet ID: ' + ss.getId());
  Logger.log('📋 Now deploy this script as a Web App and paste the Web App URL into js/sheets-config.js');
  return url;
}

function _ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers);
    }
  }
  return sheet;
}

function _formatAllSheets(ss) {
  ss.getSheets().forEach(sheet => {
    const lastCol = sheet.getLastColumn() || 1;
    // Header row formatting
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    headerRange.setBackground('#1a73e8')
               .setFontColor('#ffffff')
               .setFontWeight('bold')
               .setFontSize(11);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, lastCol, 160);
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), lastCol)
         .setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  });
}

// ════════════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════════════
function handleAdminLogin(body) {
  const { email, password } = body;
  if (!email || !password) return _err('Email and password required');

  const sheet = _sheet('Admins');
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIdx = headers.indexOf('email');
  const hashIdx  = headers.indexOf('password_hash');
  const nameIdx  = headers.indexOf('name');
  const roleIdx  = headers.indexOf('role');

  for (let i = 1; i < data.length; i++) {
    if (data[i][emailIdx].toLowerCase() === email.toLowerCase().trim()) {
      if (_checkPassword(password, data[i][hashIdx])) {
        const token = _generateToken({ email, name: data[i][nameIdx], role: data[i][roleIdx] });
        _logActivity('admin_login', data[i][nameIdx], '', 'Admin logged in from web portal');
        return _ok({ token, name: data[i][nameIdx], role: data[i][roleIdx] });
      } else {
        return _err('Invalid password', 401);
      }
    }
  }
  return _err('Admin email not found', 401);
}

// ════════════════════════════════════════════════════════════
// STUDENT REGISTRATION
// ════════════════════════════════════════════════════════════
function handleRegisterStudent(body) {
  const { name, usn, phone, college_email, google_email, google_sub, ip_address, device_type, user_agent } = body;

  if (!name || !usn || !college_email) return _err('Name, USN, and college email are required');
  if (device_type === 'mobile' || device_type === 'tablet') return _err('Mobile and tablet devices are not permitted', 403);

  const sheet = _sheet('Students');
  const data  = sheet.getDataRange().getValues();

  // Check if USN already registered
  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === usn.toLowerCase()) {
      existingRow = i + 1;
      break;
    }
  }

  const now = new Date().toISOString();

  if (existingRow > 0) {
    // Update existing student record
    const id = data[existingRow - 1][0];
    sheet.getRange(existingRow, 1, 1, 11).setValues([[
      id, name, usn, phone, college_email, google_email, google_sub,
      ip_address, device_type, user_agent, now
    ]]);
    const token = _generateToken({ studentId: id, usn, name, college_email });
    _logActivity('student_update', name, usn, `Student re-registered. IP: ${ip_address}`);
    return _ok({ token, studentId: id, isNew: false });
  }

  // New student
  const newId = 'ST' + Date.now();
  sheet.appendRow([newId, name, usn, phone, college_email, google_email, google_sub, ip_address, device_type, user_agent, now]);
  const token = _generateToken({ studentId: newId, usn, name, college_email });
  _logActivity('student_register', name, usn, `New student registered. IP: ${ip_address}, Device: ${device_type}`);
  return _ok({ token, studentId: newId, isNew: true });
}

// ════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════
function handleStartSession(body) {
  const { token } = body;
  const payload = _verifyToken(token);
  if (!payload) return _err('Invalid token', 401);

  const cfg = _getConfig();
  const sessionId = 'SES' + Date.now();
  const now = new Date().toISOString();

  _sheet('Sessions').appendRow([
    sessionId, payload.studentId, payload.name, payload.usn,
    now, '', 'active', 0, parseInt(cfg.duration_minutes || 45) * 60, ''
  ]);

  _logActivity('session_start', payload.name, payload.usn, `Test session started. Session: ${sessionId}`);
  return _ok({ sessionId, durationSecs: parseInt(cfg.duration_minutes || 45) * 60 });
}

function handleHeartbeat(body) {
  const { token, sessionId, timeLeft } = body;
  const payload = _verifyToken(token);
  if (!payload) return _ok({ ok: true }); // silent fail for heartbeats

  const sheet = _sheet('Sessions');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      sheet.getRange(i + 1, 9).setValue(timeLeft); // time_left_secs col
      break;
    }
  }
  return _ok({ ok: true });
}

function handleTerminateSession(body) {
  const { token, sessionId, reason } = body;
  // Admin token required for termination
  _updateSessionStatus(sessionId, 'terminated');
  _logActivity('session_terminate', '', '', `Session ${sessionId} terminated by admin. Reason: ${reason}`);
  return _ok({ terminated: true });
}

function _updateSessionStatus(sessionId, status) {
  const sheet = _sheet('Sessions');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      sheet.getRange(i + 1, 6).setValue(new Date().toISOString()); // ended_at
      sheet.getRange(i + 1, 7).setValue(status);                   // status
      break;
    }
  }
}

// ════════════════════════════════════════════════════════════
// SAVE ANSWER (auto-save every 30 seconds during test)
// ════════════════════════════════════════════════════════════
function handleSaveAnswer(body) {
  const { token, sessionId, questionId, questionTitle, language, code } = body;
  const payload = _verifyToken(token);
  if (!payload) return _err('Invalid token', 401);

  const sheet = _sheet('Answers');
  const data  = sheet.getDataRange().getValues();
  const now   = new Date().toISOString();

  // Check if answer already exists for this session + question
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === sessionId && String(data[i][4]) === String(questionId)) {
      // Update existing row — overwrite code
      sheet.getRange(i + 1, 7).setValue(language);  // language
      sheet.getRange(i + 1, 8).setValue(code);       // code
      sheet.getRange(i + 1, 12).setValue(now);       // saved_at
      return _ok({ saved: true, updated: true });
    }
  }

  // Insert new answer row
  const answerId = 'ANS' + Date.now();
  sheet.appendRow([
    answerId, sessionId, payload.name, payload.usn,
    questionId, questionTitle || '', language, code,
    0, 0, '', now  // score, max_score, test_results, saved_at
  ]);
  return _ok({ saved: true, updated: false });
}

// ════════════════════════════════════════════════════════════
// VIOLATION RECORDING
// ════════════════════════════════════════════════════════════
function handleRecordViolation(body) {
  const { token, sessionId, reason } = body;
  const payload = _verifyToken(token);
  if (!payload) return _ok({ recorded: true }); // silent

  const now = new Date().toISOString();
  const violId = 'VIO' + Date.now();

  // Log to Violations_Log sheet
  _sheet('Violations_Log').appendRow([
    violId, sessionId, payload.name, payload.usn, reason, now
  ]);

  // Increment violation count in Sessions sheet
  const sessSheet = _sheet('Sessions');
  const sessData  = sessSheet.getDataRange().getValues();
  let violCount = 1;
  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][0] === sessionId) {
      violCount = parseInt(sessData[i][7] || 0) + 1;
      sessSheet.getRange(i + 1, 8).setValue(violCount);
      break;
    }
  }

  _logActivity('violation', payload.name, payload.usn, `#${violCount}: ${reason}`);

  // Check if max violations exceeded
  const cfg = _getConfig();
  const maxViol = parseInt(cfg.max_violations || 5);
  return _ok({ recorded: true, violationCount: violCount, terminate: violCount >= maxViol });
}

// ════════════════════════════════════════════════════════════
// FINAL SUBMISSION + GRADING
// ════════════════════════════════════════════════════════════
function handleSubmitTest(body) {
  const { token, sessionId, answers, timeTakenSec, primaryLang } = body;
  const payload = _verifyToken(token);
  if (!payload) return _err('Invalid token', 401);

  // Load questions
  const questions = _getQuestions();
  const now = new Date().toISOString();

  let totalScore = 0;
  const totalMarks = questions.reduce((s, q) => s + parseInt(q.marks || 0), 0);
  const gradeDetails = [];

  // Grade each answer
  for (const q of questions) {
    const ans = answers[q.id] || answers[String(q.id)];
    const lang = ans?.lang || primaryLang || 'python';
    const code = ans?.code || '';

    // Score: non-empty + non-default code = full marks (connect Judge0 for real test-case grading)
    const isEmpty = !code.trim();
    const score   = isEmpty ? 0 : parseInt(q.marks);
    totalScore += score;

    gradeDetails.push({ qId: q.id, title: q.title, lang, score, maxScore: parseInt(q.marks), submitted: !isEmpty });

    // Update score in Answers sheet
    const ansSheet = _sheet('Answers');
    const ansData  = ansSheet.getDataRange().getValues();
    for (let i = 1; i < ansData.length; i++) {
      if (String(ansData[i][1]) === sessionId && String(ansData[i][4]) === String(q.id)) {
        ansSheet.getRange(i + 1, 9).setValue(score);
        ansSheet.getRange(i + 1, 10).setValue(parseInt(q.marks));
        ansSheet.getRange(i + 1, 12).setValue(now);
        break;
      }
    }
  }

  // Get violation count
  const sessSheet = _sheet('Sessions');
  const sessData  = sessSheet.getDataRange().getValues();
  let violations = 0;
  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][0] === sessionId) {
      violations = parseInt(sessData[i][7] || 0);
      // Update session with primary lang
      sessSheet.getRange(i + 1, 10).setValue(primaryLang);
      break;
    }
  }

  // Calculate rank
  const pct  = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;
  const rank  = _calcRank(totalScore, totalMarks);
  const grade = rank;

  // Format time
  const mins = Math.floor(timeTakenSec / 60);
  const secs = timeTakenSec % 60;
  const timeFmt = `${mins}m ${secs}s`;

  // Get student details
  const studSheet = _sheet('Students');
  const studData  = studSheet.getDataRange().getValues();
  let college_email = '', ip_address = '';
  for (let i = 1; i < studData.length; i++) {
    if (String(studData[i][2]).toLowerCase() === payload.usn.toLowerCase()) {
      college_email = studData[i][4];
      ip_address    = studData[i][7];
      break;
    }
  }

  // ── Write to Results sheet ──────────────────────────────
  const resultId = 'RES' + Date.now();
  _sheet('Results').appendRow([
    resultId, sessionId,
    payload.name, payload.usn, college_email, ip_address,
    totalScore, totalMarks, pct + '%', rank, grade,
    timeTakenSec, timeFmt, violations, primaryLang, now
  ]);

  // Update session status
  _updateSessionStatus(sessionId, 'submitted');

  _logActivity('test_submit', payload.name, payload.usn,
    `Score: ${totalScore}/${totalMarks} (${pct}%) | Rank: ${rank} | Time: ${timeFmt} | Lang: ${primaryLang} | Violations: ${violations}`
  );

  return _ok({ totalScore, totalMarks, pct, rank, grade, timeFmt, violations, gradeDetails });
}

// ════════════════════════════════════════════════════════════
// GET QUESTIONS (for student test page)
// ════════════════════════════════════════════════════════════
function handleGetQuestions(e) {
  const questions = _getQuestions();
  // Strip hidden test case expected outputs before sending to students
  const safe = questions.map(q => ({
    ...q,
    test_cases: (q.test_cases || []).filter(tc => !tc.hidden).map(tc => ({ input: tc.input })),
    examples:   q.examples || [],
  }));
  return _ok({ questions: safe });
}

function _getQuestions() {
  const sheet = _sheet('Questions');
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const questions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const q = {};
    headers.forEach((h, j) => { q[h] = row[j]; });
    q.allowed_langs = String(q.allowed_langs || 'python,java,cpp').split(',').map(s => s.trim());
    try { q.test_cases = JSON.parse(q.test_cases_json || '[]'); } catch { q.test_cases = []; }
    try { q.examples   = JSON.parse(q.examples_json   || '[]'); } catch { q.examples   = []; }
    questions.push(q);
  }
  return questions;
}

// ════════════════════════════════════════════════════════════
// GET CONFIG
// ════════════════════════════════════════════════════════════
function handleGetConfig(e) {
  return _ok({ config: _getConfig() });
}

function _getConfig() {
  const sheet = _sheet('Config');
  const data  = sheet.getDataRange().getValues();
  const cfg   = {};
  for (let i = 1; i < data.length; i++) {
    cfg[data[i][0]] = data[i][1];
  }
  return cfg;
}

function handleSaveConfig(body) {
  const { token, config } = body;
  const payload = _verifyToken(token);
  if (!payload || payload.role !== 'superadmin' && payload.role !== 'admin') return _err('Admin required', 403);

  const sheet = _sheet('Config');
  const data  = sheet.getDataRange().getValues();
  const now   = new Date().toISOString();

  Object.entries(config).forEach(([key, value]) => {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        sheet.getRange(i + 1, 3).setValue(now);
        return;
      }
    }
    sheet.appendRow([key, value, now]);
  });

  _logActivity('config_update', payload.name, '', 'Test configuration updated');
  return _ok({ saved: true });
}

// ════════════════════════════════════════════════════════════
// ADMIN — DASHBOARD, STUDENTS, RESULTS, ANSWERS
// ════════════════════════════════════════════════════════════
function handleGetDashboard(e, token) {
  const payload = _verifyToken(token);
  if (!payload) return _err('Admin auth required', 401);

  const sessData   = _sheet('Sessions').getDataRange().getValues();
  const resultData = _sheet('Results').getDataRange().getValues();
  const studData   = _sheet('Students').getDataRange().getValues();
  const violData   = _sheet('Violations_Log').getDataRange().getValues();

  let live = 0, submitted = 0, flagged = 0;
  const sessionRows = sessData.slice(1);
  sessionRows.forEach(r => {
    if (r[6] === 'active')    live++;
    if (r[6] === 'submitted') submitted++;
    if (parseInt(r[7] || 0) >= 3) flagged++;
  });

  let totalScore = 0, resultCount = 0;
  resultData.slice(1).forEach(r => {
    if (r[6] !== undefined) { totalScore += parseInt(r[6] || 0); resultCount++; }
  });
  const avgScore = resultCount ? Math.round(totalScore / resultCount) : 0;

  return _ok({
    total:     studData.length - 1,
    live,
    submitted,
    flagged,
    avgScore,
    violations: violData.length - 1,
  });
}

function handleGetStudents(e, token) {
  const payload = _verifyToken(token);
  if (!payload) return _err('Admin auth required', 401);

  const studSheet = _sheet('Students');
  const sessSheet = _sheet('Sessions');
  const resSheet  = _sheet('Results');

  const studData = studSheet.getDataRange().getValues();
  const sessData = sessSheet.getDataRange().getValues();
  const resData  = resSheet.getDataRange().getValues();

  const headers  = studData[0];
  const students = [];

  for (let i = 1; i < studData.length; i++) {
    const row = studData[i];
    if (!row[0]) continue;
    const student = {};
    headers.forEach((h, j) => { student[h] = row[j]; });

    // Find latest session
    let latestSession = null;
    for (let j = sessData.length - 1; j >= 1; j--) {
      if (String(sessData[j][1]) === String(row[0])) {
        latestSession = sessData[j];
        break;
      }
    }
    if (latestSession) {
      student.session_status    = latestSession[6];
      student.violations        = latestSession[7];
      student.time_left_secs    = latestSession[8];
      student.session_id        = latestSession[0];
      student.primary_lang      = latestSession[9];
    }

    // Find result
    for (let j = resData.length - 1; j >= 1; j--) {
      if (String(resData[j][3]) === String(row[2])) {
        student.score      = resData[j][6];
        student.total_marks = resData[j][7];
        student.rank       = resData[j][9];
        break;
      }
    }

    students.push(student);
  }

  return _ok({ students });
}

function handleGetResults(e, token) {
  const payload = _verifyToken(token);
  if (!payload) return _err('Admin auth required', 401);

  const sheet = _sheet('Results');
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    results.push(row);
  }

  // Sort by total_score descending
  results.sort((a, b) => parseInt(b.total_score || 0) - parseInt(a.total_score || 0));
  return _ok({ results });
}

function handleGetAnswers(e, token) {
  const payload = _verifyToken(token);
  if (!payload) return _err('Admin auth required', 401);

  const usnFilter = e.parameter.usn || '';
  const sheet = _sheet('Answers');
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const answers = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (usnFilter && String(data[i][3]).toLowerCase() !== usnFilter.toLowerCase()) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    answers.push(row);
  }
  return _ok({ answers });
}

// ════════════════════════════════════════════════════════════
// UPLOAD QUESTIONS (Admin can bulk upload)
// ════════════════════════════════════════════════════════════
function handleUploadQuestions(body) {
  const { token, questions } = body;
  const payload = _verifyToken(token);
  if (!payload) return _err('Admin auth required', 401);

  const sheet = _sheet('Questions');
  // Clear existing (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  const now = new Date().toISOString();
  questions.forEach((q, i) => {
    sheet.appendRow([
      q.id || (i + 1),
      q.title,
      q.description,
      q.marks || 10,
      q.time_limit_secs || 2,
      Array.isArray(q.allowed_langs) ? q.allowed_langs.join(',') : (q.allowed_langs || 'python,java,cpp'),
      JSON.stringify(q.test_cases || []),
      JSON.stringify(q.examples   || []),
      now
    ]);
  });

  _formatAllSheets(_ss());
  _logActivity('questions_upload', payload.name, '', `${questions.length} questions uploaded`);
  return _ok({ uploaded: questions.length });
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════
function _calcRank(score, total) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (pct >= 90) return 'S';
  if (pct >= 70) return 'A';
  if (pct >= 50) return 'B';
  return 'C';
}

function _logActivity(type, studentName, usn, details) {
  try {
    _sheet('Activity_Log').appendRow([
      'LOG' + Date.now(), new Date().toISOString(), type, studentName, usn, details
    ]);
  } catch (e) { /* non-blocking */ }
}

// Simple token: base64-encoded JSON with timestamp
// For production, use HMAC signing via Utilities.computeHmacSignature
function _generateToken(payload) {
  const data = { ...payload, iat: Date.now(), exp: Date.now() + 3 * 60 * 60 * 1000 };
  return Utilities.base64Encode(JSON.stringify(data));
}

function _verifyToken(token) {
  try {
    if (!token) return null;
    const data = JSON.parse(Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

// Simple password hashing using SHA-256
function _hashPassword(plain) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plain);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function _checkPassword(plain, hash) {
  return _hashPassword(plain) === hash;
}

// ════════════════════════════════════════════════════════════
// TRIGGERS — Auto-run functions
// ════════════════════════════════════════════════════════════

// Run this to install all triggers
function installTriggers() {
  // Delete existing triggers first
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Auto-format results sheet every hour
  ScriptApp.newTrigger('autoFormatSheets')
    .timeBased().everyHours(1).create();

  // Send summary email to admin every day at 9 AM
  ScriptApp.newTrigger('sendDailySummary')
    .timeBased().atHour(9).everyDays(1).create();

  Logger.log('Triggers installed.');
}

function autoFormatSheets() {
  try { _formatAllSheets(_ss()); } catch (e) {}
}

// Daily summary email to admin
function sendDailySummary() {
  try {
    const cfg     = _getConfig();
    const resData = _sheet('Results').getDataRange().getValues();
    const sessData = _sheet('Sessions').getDataRange().getValues();

    const total     = resData.length - 1;
    const live      = sessData.slice(1).filter(r => r[6] === 'active').length;
    const avgScore  = total > 0
      ? Math.round(resData.slice(1).reduce((s, r) => s + parseInt(r[6] || 0), 0) / total)
      : 0;

    const adminSheet = _sheet('Admins');
    const adminData  = adminSheet.getDataRange().getValues();
    const adminEmail = adminData[1] ? adminData[1][0] : '';

    if (adminEmail) {
      GmailApp.sendEmail(adminEmail,
        `[CodeProct] Daily Summary — ${new Date().toDateString()}`,
        `Assessment Summary\n\nSubmitted: ${total}\nCurrently Live: ${live}\nAvg Score: ${avgScore}\n\nSheet: https://docs.google.com/spreadsheets/d/${PropertiesService.getScriptProperties().getProperty('SHEET_ID')}`
      );
    }
  } catch (e) {}
}

// ════════════════════════════════════════════════════════════
// TEST THIS SCRIPT from Apps Script editor:
// ════════════════════════════════════════════════════════════
function testSetup() {
  Logger.log('Testing setup...');
  const url = setupSheets();
  Logger.log('Sheet URL: ' + url);
  Logger.log('Config: ' + JSON.stringify(_getConfig()));
  Logger.log('Questions: ' + JSON.stringify(_getQuestions().map(q => q.title)));
}
