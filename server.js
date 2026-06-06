// ============================================================
// CODEPROCT — SERVER.JS
// Node.js + Express backend for production deployment
// Handles: auth, sessions, submissions, admin APIs, Excel I/O
// ============================================================

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const multer     = require('multer');
const XLSX       = require('xlsx');
const path       = require('path');
const fs         = require('fs');
const fetch      = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

// ── DB (SQLite via better-sqlite3 for simplicity; swap for PostgreSQL) ──
const Database = require('better-sqlite3');
const db = new Database('./codeproct.db');

// ── APP SETUP ──────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'codeproct_secret_change_in_prod';
const upload     = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../')));  // serve frontend

// ── DATABASE INIT ──────────────────────────────────────────
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      email    TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name     TEXT,
      role     TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title            TEXT NOT NULL,
      description      TEXT,
      marks            INTEGER DEFAULT 10,
      time_limit_secs  INTEGER DEFAULT 2,
      allowed_langs    TEXT DEFAULT 'python,java,cpp',
      test_cases       TEXT,   -- JSON array
      examples         TEXT,   -- JSON array
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_config (
      id                   INTEGER PRIMARY KEY,
      duration_minutes     INTEGER DEFAULT 45,
      start_datetime       TEXT,
      video_proctoring     INTEGER DEFAULT 1,
      tab_detection        INTEGER DEFAULT 1,
      paste_blocked        INTEGER DEFAULT 1,
      fullscreen_required  INTEGER DEFAULT 1,
      access_code          TEXT DEFAULT '',
      max_violations       INTEGER DEFAULT 5,
      updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      usn           TEXT UNIQUE NOT NULL,
      phone         TEXT,
      email         TEXT,
      google_email  TEXT,
      google_sub    TEXT,
      ip_address    TEXT,
      user_agent    TEXT,
      device_type   TEXT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER REFERENCES students(id),
      started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at    DATETIME,
      status      TEXT DEFAULT 'active',   -- active | submitted | terminated
      violations  INTEGER DEFAULT 0,
      time_left   INTEGER
    );

    CREATE TABLE IF NOT EXISTS answers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER REFERENCES sessions(id),
      question_id INTEGER REFERENCES questions(id),
      lang        TEXT,
      code        TEXT,
      score       INTEGER DEFAULT 0,
      max_score   INTEGER DEFAULT 0,
      test_results TEXT,   -- JSON
      saved_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS violations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER REFERENCES sessions(id),
      reason      TEXT,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS results (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   INTEGER REFERENCES sessions(id),
      student_id   INTEGER REFERENCES students(id),
      total_score  INTEGER DEFAULT 0,
      total_marks  INTEGER DEFAULT 0,
      rank         TEXT,
      time_taken   INTEGER,
      violations   INTEGER DEFAULT 0,
      primary_lang TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default admin if none exists
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  if (adminCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO admins (email, password, name, role) VALUES (?, ?, ?, ?)")
      .run('admin@test.com', hash, 'Admin User', 'superadmin');
    console.log('[DB] Default admin seeded: admin@test.com / admin123');
  }

  // Seed default test config
  const cfgCount = db.prepare('SELECT COUNT(*) as c FROM test_config').get().c;
  if (cfgCount === 0) {
    db.prepare("INSERT INTO test_config (id, duration_minutes) VALUES (1, 45)").run();
  }
}

// ── MIDDLEWARE ─────────────────────────────────────────────
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authStudent(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.student = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ════════════════════════════════════════════════════════════
// ADMIN AUTH ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
});

// ════════════════════════════════════════════════════════════
// STUDENT SESSION ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/student/register — called after Google auth + details form
app.post('/api/student/register', (req, res) => {
  const { name, usn, phone, email, googleEmail, googleSub, ip, userAgent } = req.body;
  if (!name || !usn || !email) return res.status(400).json({ error: 'Missing required fields' });

  const device = /mobile|tablet/i.test(userAgent || '') ? 'mobile' : 'desktop';
  if (device !== 'desktop') return res.status(403).json({ error: 'Mobile/tablet access not permitted' });

  try {
    const existing = db.prepare('SELECT id FROM students WHERE usn = ?').get(usn);
    let studentId;

    if (existing) {
      db.prepare('UPDATE students SET name=?, phone=?, email=?, google_email=?, google_sub=?, ip_address=?, user_agent=? WHERE usn=?')
        .run(name, phone, email, googleEmail, googleSub, ip, userAgent, usn);
      studentId = existing.id;
    } else {
      const result = db.prepare(
        'INSERT INTO students (name, usn, phone, email, google_email, google_sub, ip_address, user_agent, device_type) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(name, usn, phone, email, googleEmail, googleSub, ip, userAgent, 'desktop');
      studentId = result.lastInsertRowid;
    }

    // Create session
    const config = db.prepare('SELECT * FROM test_config WHERE id = 1').get();
    const session = db.prepare('INSERT INTO sessions (student_id, time_left) VALUES (?, ?)').run(studentId, (config?.duration_minutes || 45) * 60);

    const token = jwt.sign({ studentId, sessionId: session.lastInsertRowid, usn, name }, JWT_SECRET, { expiresIn: '3h' });

    // Notify admin via socket
    io.to('admins').emit('student:joined', { name, usn, ip, sessionId: session.lastInsertRowid });

    res.json({ token, sessionId: session.lastInsertRowid, studentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// POST /api/student/answer/save — auto-save every 30s
app.post('/api/student/answer/save', authStudent, (req, res) => {
  const { questionId, lang, code } = req.body;
  const { sessionId } = req.student;

  const existing = db.prepare('SELECT id FROM answers WHERE session_id=? AND question_id=?').get(sessionId, questionId);
  if (existing) {
    db.prepare('UPDATE answers SET lang=?, code=?, saved_at=CURRENT_TIMESTAMP WHERE id=?').run(lang, code, existing.id);
  } else {
    db.prepare('INSERT INTO answers (session_id, question_id, lang, code) VALUES (?,?,?,?)').run(sessionId, questionId, lang, code);
  }
  res.json({ saved: true });
});

// POST /api/student/violation — record a proctoring violation
app.post('/api/student/violation', authStudent, (req, res) => {
  const { reason } = req.body;
  const { sessionId } = req.student;

  db.prepare('INSERT INTO violations (session_id, reason) VALUES (?,?)').run(sessionId, reason);
  db.prepare('UPDATE sessions SET violations = violations + 1 WHERE id=?').run(sessionId);

  const session = db.prepare('SELECT violations FROM sessions WHERE id=?').get(sessionId);
  const config  = db.prepare('SELECT max_violations FROM test_config WHERE id=1').get();

  // Notify admin
  io.to('admins').emit('student:violation', { sessionId, reason, totalViolations: session.violations });

  // Auto-terminate if limit reached
  if (session.violations >= (config?.max_violations || 5)) {
    db.prepare("UPDATE sessions SET status='terminated' WHERE id=?").run(sessionId);
    return res.json({ saved: true, terminate: true });
  }
  res.json({ saved: true, terminate: false });
});

// POST /api/student/submit — final submission
app.post('/api/student/submit', authStudent, async (req, res) => {
  const { answers, timeTakenSec, primaryLang } = req.body;
  const { sessionId, studentId } = req.student;

  const questions = db.prepare('SELECT * FROM questions ORDER BY id').all();
  const config    = db.prepare('SELECT * FROM test_config WHERE id=1').get();
  const session   = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);

  let totalScore = 0;
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const gradeDetails = [];

  for (const q of questions) {
    const ans = answers[q.id];
    if (!ans) { gradeDetails.push({ qId: q.id, score: 0, maxScore: q.marks }); continue; }

    const { lang, code } = ans;
    const testCases = JSON.parse(q.test_cases || '[]');

    // Grade via Judge0 (or simulate)
    let score = 0;
    try {
      score = await _gradeAnswer(code, lang, testCases, q.marks);
    } catch {
      score = code.trim() ? Math.round(q.marks * 0.5) : 0;  // partial if code present
    }

    totalScore += score;
    gradeDetails.push({ qId: q.id, score, maxScore: q.marks, lang });

    // Save graded answer
    db.prepare('UPDATE answers SET score=?, max_score=? WHERE session_id=? AND question_id=?')
      .run(score, q.marks, sessionId, q.id);
  }

  const rank = _calcRank(totalScore, totalMarks);

  // Save result
  db.prepare(`
    INSERT INTO results (session_id, student_id, total_score, total_marks, rank, time_taken, violations, primary_lang)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(sessionId, studentId, totalScore, totalMarks, rank, timeTakenSec, session.violations, primaryLang);

  // Close session
  db.prepare("UPDATE sessions SET status='submitted', ended_at=CURRENT_TIMESTAMP WHERE id=?").run(sessionId);

  // Export to Excel
  _appendResultToExcel({ sessionId, studentId, totalScore, totalMarks, rank, timeTakenSec, violations: session.violations, primaryLang });

  // Notify admin
  io.to('admins').emit('student:submitted', { sessionId, totalScore, totalMarks, rank });

  res.json({ totalScore, totalMarks, rank, gradeDetails, violations: session.violations });
});

// GET /api/student/questions — load questions for the test
app.get('/api/student/questions', authStudent, (req, res) => {
  const rows = db.prepare('SELECT id, title, description, marks, time_limit_secs, allowed_langs, examples FROM questions ORDER BY id').all();
  const questions = rows.map(q => ({
    ...q,
    allowed_langs: q.allowed_langs.split(','),
    examples: JSON.parse(q.examples || '[]'),
  }));
  res.json({ questions });
});

// GET /api/student/config — load test config
app.get('/api/student/config', authStudent, (req, res) => {
  const cfg = db.prepare('SELECT * FROM test_config WHERE id=1').get();
  res.json(cfg || {});
});

// ════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════════════════════════

// GET /api/admin/dashboard
app.get('/api/admin/dashboard', authAdmin, (req, res) => {
  const total     = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
  const live      = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status='active'").get().c;
  const submitted = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status='submitted'").get().c;
  const flagged   = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE violations >= 3').get().c;
  const avgScore  = db.prepare("SELECT AVG(total_score) as avg FROM results").get().avg;

  res.json({ total, live, submitted, flagged, avgScore: Math.round(avgScore || 0) });
});

// GET /api/admin/students
app.get('/api/admin/students', authAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT s.name, s.usn, s.email, s.phone, s.ip_address, s.device_type,
           ss.status, ss.violations, ss.time_left, ss.id as session_id,
           r.total_score, r.total_marks, r.primary_lang
    FROM students s
    LEFT JOIN sessions ss ON ss.student_id = s.id AND ss.id = (
      SELECT id FROM sessions WHERE student_id = s.id ORDER BY started_at DESC LIMIT 1
    )
    LEFT JOIN results r ON r.session_id = ss.id
    ORDER BY ss.started_at DESC
  `).all();
  res.json({ students: rows });
});

// GET /api/admin/results
app.get('/api/admin/results', authAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT s.name, s.usn, s.email,
           r.total_score, r.total_marks, r.rank, r.time_taken,
           r.violations, r.primary_lang, r.submitted_at
    FROM results r
    JOIN students s ON s.id = r.student_id
    ORDER BY r.total_score DESC
  `).all();
  res.json({ results: rows });
});

// GET /api/admin/questions
app.get('/api/admin/questions', authAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM questions ORDER BY id').all();
  const questions = rows.map(q => ({
    ...q,
    allowed_langs: q.allowed_langs.split(','),
    test_cases: JSON.parse(q.test_cases || '[]'),
    examples:   JSON.parse(q.examples   || '[]'),
  }));
  res.json({ questions });
});

// POST /api/admin/questions — create
app.post('/api/admin/questions', authAdmin, (req, res) => {
  const { title, description, marks, time_limit_secs, allowed_langs, test_cases, examples } = req.body;
  const result = db.prepare(
    'INSERT INTO questions (title, description, marks, time_limit_secs, allowed_langs, test_cases, examples) VALUES (?,?,?,?,?,?,?)'
  ).run(title, description, marks, time_limit_secs, allowed_langs.join(','), JSON.stringify(test_cases), JSON.stringify(examples));
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/admin/questions/:id — update
app.put('/api/admin/questions/:id', authAdmin, (req, res) => {
  const { title, description, marks, time_limit_secs, allowed_langs, test_cases, examples } = req.body;
  db.prepare(
    'UPDATE questions SET title=?, description=?, marks=?, time_limit_secs=?, allowed_langs=?, test_cases=?, examples=? WHERE id=?'
  ).run(title, description, marks, time_limit_secs, allowed_langs.join(','), JSON.stringify(test_cases), JSON.stringify(examples), req.params.id);
  res.json({ updated: true });
});

// DELETE /api/admin/questions/:id
app.delete('/api/admin/questions/:id', authAdmin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id=?').run(req.params.id);
  res.json({ deleted: true });
});

// GET /api/admin/config
app.get('/api/admin/config', authAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM test_config WHERE id=1').get());
});

// PUT /api/admin/config
app.put('/api/admin/config', authAdmin, (req, res) => {
  const { duration_minutes, start_datetime, video_proctoring, tab_detection, paste_blocked, fullscreen_required, access_code, max_violations } = req.body;
  db.prepare(`
    UPDATE test_config SET
      duration_minutes=?, start_datetime=?, video_proctoring=?,
      tab_detection=?, paste_blocked=?, fullscreen_required=?,
      access_code=?, max_violations=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=1
  `).run(duration_minutes, start_datetime, video_proctoring?1:0, tab_detection?1:0, paste_blocked?1:0, fullscreen_required?1:0, access_code, max_violations);
  res.json({ updated: true });
});

// GET /api/admin/violations/:sessionId
app.get('/api/admin/violations/:sessionId', authAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM violations WHERE session_id=? ORDER BY occurred_at DESC').all(req.params.sessionId);
  res.json({ violations: rows });
});

// POST /api/admin/terminate/:sessionId
app.post('/api/admin/terminate/:sessionId', authAdmin, (req, res) => {
  db.prepare("UPDATE sessions SET status='terminated', ended_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.sessionId);
  io.to(`session:${req.params.sessionId}`).emit('test:terminated', { reason: req.body.reason || 'Admin terminated session' });
  res.json({ terminated: true });
});

// ─── Excel Upload ──────────────────────────────────────────
// POST /api/admin/upload/excel
app.post('/api/admin/upload/excel', authAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const wb = XLSX.readFile(req.file.path);
    const result = { questions: 0, students: 0, config: false, admins: 0 };

    // Sheet: Questions
    if (wb.Sheets['Questions']) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Questions']);
      db.prepare('DELETE FROM questions').run();
      for (const row of rows) {
        db.prepare('INSERT INTO questions (title, description, marks, time_limit_secs, allowed_langs, test_cases, examples) VALUES (?,?,?,?,?,?,?)')
          .run(
            row.title, row.description, row.marks || 10, row.time_limit_seconds || 2,
            row.allowed_languages || 'python,java,cpp',
            row.test_cases || '[]', row.examples || '[]'
          );
        result.questions++;
      }
    }

    // Sheet: Config
    if (wb.Sheets['Config']) {
      const row = XLSX.utils.sheet_to_json(wb.Sheets['Config'])[0];
      if (row) {
        db.prepare(`UPDATE test_config SET
          duration_minutes=?, start_datetime=?, video_proctoring=?,
          tab_detection=?, paste_blocked=?, fullscreen_required=?,
          access_code=?, max_violations=? WHERE id=1`)
          .run(row.duration_minutes || 45, row.start_datetime || null,
               row.video_proctoring ? 1 : 0, row.tab_detection ? 1 : 0,
               row.paste_blocked ? 1 : 0, row.fullscreen_required ? 1 : 0,
               row.access_code || '', row.max_violations || 5);
        result.config = true;
      }
    }

    // Sheet: Admins
    if (wb.Sheets['Admins']) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Admins']);
      for (const row of rows) {
        if (!row.email || !row.password) continue;
        const hash = bcrypt.hashSync(row.password, 10);
        try {
          db.prepare('INSERT OR REPLACE INTO admins (email, password, name, role) VALUES (?,?,?,?)')
            .run(row.email, hash, row.name || 'Admin', row.role || 'admin');
          result.admins++;
        } catch {}
      }
    }

    // Sheet: Students (pre-registered)
    if (wb.Sheets['Students']) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Students']);
      for (const row of rows) {
        if (!row.usn) continue;
        try {
          db.prepare('INSERT OR IGNORE INTO students (name, usn, phone, email, google_email) VALUES (?,?,?,?,?)')
            .run(row.name, row.usn, row.phone, row.college_email, row.google_email || '');
          result.students++;
        } catch {}
      }
    }

    fs.unlinkSync(req.file.path);  // clean up temp file
    res.json({ success: true, ...result });

  } catch (err) {
    res.status(500).json({ error: 'Excel parsing failed: ' + err.message });
  }
});

// GET /api/admin/export/results — download results as Excel
app.get('/api/admin/export/results', authAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT s.name, s.usn, s.email, s.ip_address,
           r.total_score, r.total_marks, r.rank, r.time_taken,
           r.violations, r.primary_lang, r.submitted_at
    FROM results r JOIN students s ON s.id = r.student_id
    ORDER BY r.total_score DESC
  `).all();

  const ws = XLSX.utils.json_to_sheet(rows.map((r, i) => ({
    'Rank':         i + 1,
    'Name':         r.name,
    'USN':          r.usn,
    'Email':        r.email,
    'IP Address':   r.ip_address,
    'Score':        `${r.total_score}/${r.total_marks}`,
    'Percentage':   `${Math.round((r.total_score / r.total_marks) * 100)}%`,
    'Grade':        r.rank,
    'Time Taken':   `${Math.floor(r.time_taken / 60)}m ${r.time_taken % 60}s`,
    'Violations':   r.violations,
    'Language':     r.primary_lang,
    'Submitted At': r.submitted_at,
  })));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=codeproct_results.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ════════════════════════════════════════════════════════════
// CODE EXECUTION PROXY (avoids CORS on Judge0)
// ════════════════════════════════════════════════════════════

// POST /api/execute/submit
app.post('/api/execute/submit', authStudent, async (req, res) => {
  const { source_code, language_id, stdin } = req.body;
  try {
    const r = await fetch(`${process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com'}/submissions?base64_encoded=true&wait=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.JUDGE0_KEY || '',
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
      },
      body: JSON.stringify({ language_id, source_code, stdin }),
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/execute/result/:token
app.get('/api/execute/result/:token', authStudent, async (req, res) => {
  try {
    const r = await fetch(
      `${process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com'}/submissions/${req.params.token}?base64_encoded=true`,
      { headers: { 'X-RapidAPI-Key': process.env.JUDGE0_KEY || '', 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' } }
    );
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// SOCKET.IO — Real-time admin monitoring
// ════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log('[Socket] Connected:', socket.id);

  // Admin joins their room
  socket.on('admin:join', (token) => {
    try {
      jwt.verify(token, JWT_SECRET);
      socket.join('admins');
      console.log('[Socket] Admin joined monitoring room');
    } catch { socket.disconnect(); }
  });

  // Student identifies their session
  socket.on('student:identify', (token) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.join(`session:${payload.sessionId}`);
    } catch { socket.disconnect(); }
  });

  // Student heartbeat (time sync)
  socket.on('student:heartbeat', ({ sessionId, timeLeft }) => {
    db.prepare('UPDATE sessions SET time_left=? WHERE id=?').run(timeLeft, sessionId);
    io.to('admins').emit('student:heartbeat', { sessionId, timeLeft });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
  });
});

// ── HELPERS ────────────────────────────────────────────────
async function _gradeAnswer(code, lang, testCases, maxMarks) {
  if (!process.env.JUDGE0_KEY || !testCases.length) {
    return code.trim() ? maxMarks : 0;
  }

  const langIds = { python: 71, java: 62, cpp: 54 };
  const langId  = langIds[lang] || 71;

  let passed = 0;
  for (const tc of testCases) {
    try {
      const submitRes = await fetch(`${process.env.JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': process.env.JUDGE0_KEY },
        body: JSON.stringify({
          language_id: langId,
          source_code: Buffer.from(code).toString('base64'),
          stdin:        Buffer.from(tc.input || '').toString('base64'),
        }),
      });
      const result = await submitRes.json();
      const stdout = result.stdout ? Buffer.from(result.stdout, 'base64').toString().trim() : '';
      if (stdout === tc.expected_output.trim()) passed++;
    } catch { /* count as failed */ }
  }

  return Math.round((passed / testCases.length) * maxMarks);
}

function _calcRank(score, total) {
  const pct = (score / total) * 100;
  if (pct >= 90) return 'S';
  if (pct >= 70) return 'A';
  if (pct >= 50) return 'B';
  return 'C';
}

function _appendResultToExcel(result) {
  const filePath = './codeproct_results.xlsx';
  let wb, ws;

  const student = db.prepare('SELECT * FROM students WHERE id=?').get(result.studentId);
  const row = {
    Name:         student?.name,
    USN:          student?.usn,
    Email:        student?.email,
    IP:           student?.ip_address,
    Score:        `${result.totalScore}/${result.totalMarks}`,
    Grade:        result.rank,
    TimeTaken:    result.timeTakenSec,
    Violations:   result.violations,
    Language:     result.primaryLang,
    SubmittedAt:  new Date().toISOString(),
  };

  if (fs.existsSync(filePath)) {
    wb = XLSX.readFile(filePath);
    ws = wb.Sheets['Results'] || XLSX.utils.aoa_to_sheet([Object.keys(row)]);
    XLSX.utils.sheet_add_json(ws, [row], { skipHeader: true, origin: -1 });
  } else {
    ws = XLSX.utils.json_to_sheet([row]);
    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
  }

  XLSX.writeFile(wb, filePath);
}

// ── START SERVER ───────────────────────────────────────────
initDB();
server.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║   CodeProct Server running on :${PORT}   ║`);
  console.log(`╚════════════════════════════════════════╝`);
  console.log(`  Frontend: http://localhost:${PORT}`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  console.log(`  API:      http://localhost:${PORT}/api\n`);
});
