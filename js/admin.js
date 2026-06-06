/* ============================================================
   CODEPROCT — ADMIN.JS
   Full admin portal: dashboard, student monitor, question
   editor, settings, results, Excel upload
   ============================================================ */

const AdminPortal = (() => {

  let currentSection = 'dashboard';
  let studentFilter  = { q: '', status: '' };
  let liveInterval   = null;

  /* ── INIT ─────────────────────────────────────────────── */
  function init() {
    _buildAdminLayout();
    navTo('dashboard');

    // Simulate live student count updates every 10s
    liveInterval = setInterval(() => {
      if (currentSection === 'dashboard') _refreshDashboardStats();
      if (currentSection === 'students')  _renderStudentTable();
    }, 10000);
  }

  function destroy() {
    clearInterval(liveInterval);
    const portal = Utils.$('adminPortal');
    if (portal) portal.innerHTML = '';
  }

  /* ── BUILD LAYOUT ─────────────────────────────────────── */
  function _buildAdminLayout() {
    const portal = Utils.$('adminPortal');
    if (!portal) return;

    portal.innerHTML = `
      <!-- Sidebar -->
      <div class="admin-sidebar">
        <div class="admin-sidebar-logo">CODE<span>PROCT</span></div>
        <div class="sidebar-section-label">OVERVIEW</div>
        <div class="admin-nav-item active" data-sec="dashboard"  onclick="AdminPortal.navTo('dashboard',  this)">📊 Dashboard</div>
        <div class="admin-nav-item"        data-sec="students"   onclick="AdminPortal.navTo('students',   this)">👥 Students</div>
        <div class="admin-nav-item"        data-sec="results"    onclick="AdminPortal.navTo('results',    this)">📈 Results</div>
        <div class="sidebar-section-label">SETUP</div>
        <div class="admin-nav-item"        data-sec="questions"  onclick="AdminPortal.navTo('questions',  this)">📝 Questions</div>
        <div class="admin-nav-item"        data-sec="settings"   onclick="AdminPortal.navTo('settings',   this)">⚙ Test Settings</div>
        <div class="admin-nav-item"        data-sec="upload"     onclick="AdminPortal.navTo('upload',     this)">📤 Upload Excel</div>

        <div class="admin-sidebar-footer">
          <div class="admin-user-info">
            <span class="admin-user-name">${Utils.escapeHtml(App.state.admin?.name || 'Admin')}</span>
            <span>${Utils.escapeHtml(App.state.admin?.email || '')}</span>
            <span style="color:var(--accent);font-size:10px">${Utils.escapeHtml(App.state.admin?.role || 'admin')}</span>
          </div>
          <button class="btn btn-danger btn-sm" style="width:100%" onclick="AdminAuth.logout()">Logout</button>
        </div>
      </div>

      <!-- Content -->
      <div class="admin-content" id="adminContent"></div>
    `;
  }

  /* ── NAVIGATION ───────────────────────────────────────── */
  function navTo(section, el) {
    currentSection = section;

    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    else {
      const target = document.querySelector(`[data-sec="${section}"]`);
      if (target) target.classList.add('active');
    }

    const content = Utils.$('adminContent');
    if (!content) return;

    const renderers = {
      dashboard: _renderDashboard,
      students:  _renderStudents,
      results:   _renderResults,
      questions: _renderQuestions,
      settings:  _renderSettings,
      upload:    _renderUpload,
    };
    (renderers[section] || (() => {}))();
  }

  /* ════════════════════════════════════════════════════════
     SECTION: DASHBOARD
     ════════════════════════════════════════════════════════ */
  function _renderDashboard() {
    const content = Utils.$('adminContent');
    const live      = MOCK_STUDENTS.filter(s => s.status === 'live').length;
    const submitted = MOCK_STUDENTS.filter(s => s.status === 'submitted').length;
    const flagged   = MOCK_STUDENTS.filter(s => s.status === 'flagged').length;

    content.innerHTML = `
      <div class="section-title">Dashboard Overview</div>
      <div class="section-sub">Real-time assessment status — Last refreshed: <span id="lastRefreshed">${new Date().toLocaleTimeString()}</span></div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val">${MOCK_STUDENTS.length.toLocaleString()}</div>
          <div class="stat-label">Registered Students</div>
          <div class="stat-delta">▲ 47 new today</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--accent)" id="dashLive">${live}</div>
          <div class="stat-label">Currently Testing</div>
          <div class="stat-delta warn">● Live</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--success)">${submitted}</div>
          <div class="stat-label">Submitted</div>
          <div class="stat-delta">Avg score: 21.4/${QUESTIONS.reduce((s,q)=>s+q.marks,0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--danger)">${flagged}</div>
          <div class="stat-label">Violations Flagged</div>
          <div class="stat-delta bad">Needs review</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="admin-card-2col">
        <div class="admin-card">
          <div class="admin-card-title">📊 Score Distribution</div>
          <div class="bar-chart" id="scoreChart"></div>
          <div class="bar-labels">
            <span>0–5</span><span>6–10</span><span>11–15</span><span>16–20</span><span>21–25</span><span>26–30</span>
          </div>
        </div>
        <div class="admin-card">
          <div class="admin-card-title">💻 Language Usage</div>
          <div id="langStats"></div>
        </div>
      </div>

      <!-- Live Activity Feed -->
      <div class="admin-card" style="margin-top:14px">
        <div class="admin-card-title">⚡ Live Activity Feed</div>
        <div id="activityFeed" style="font-size:12px;color:var(--text2);line-height:2"></div>
      </div>
    `;

    _renderScoreChart();
    _renderLangStats();
    _renderActivityFeed();
  }

  function _refreshDashboardStats() {
    const el = Utils.$('lastRefreshed');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }

  function _renderScoreChart() {
    const el = Utils.$('scoreChart');
    if (!el) return;
    const data = [
      { label: '0–5',   val: 12, color: '#ef4444' },
      { label: '6–10',  val: 34, color: '#f59e0b' },
      { label: '11–15', val: 78, color: '#f59e0b' },
      { label: '16–20', val: 156, color: '#22c55e' },
      { label: '21–25', val: 234, color: '#22c55e' },
      { label: '26–30', val: 110, color: '#00d4aa' },
    ];
    const max = Math.max(...data.map(d => d.val));
    el.innerHTML = data.map(d => `
      <div class="bar-item">
        <div class="bar-fill" style="height:${Math.round(d.val/max*100)}%;background:${d.color}">
          <span class="bar-val">${d.val}</span>
        </div>
      </div>
    `).join('');
  }

  function _renderLangStats() {
    const el = Utils.$('langStats');
    if (!el) return;
    const langs = [
      { l: 'Python', pct: 52, color: '#3b82f6' },
      { l: 'Java',   pct: 31, color: '#f59e0b' },
      { l: 'C++',    pct: 17, color: '#22c55e' },
    ];
    el.innerHTML = langs.map(x => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:var(--text2)">${x.l}</span>
          <span style="color:#fff;font-weight:600">${x.pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${x.pct}%;background:${x.color}"></div>
        </div>
      </div>
    `).join('');
  }

  function _renderActivityFeed() {
    const el = Utils.$('activityFeed');
    if (!el) return;
    const events = [
      { time: '10:41:22', msg: 'Rahul Verma — Violation #4 recorded (paste attempt)', color: 'var(--danger)' },
      { time: '10:40:11', msg: 'Divya Menon — Q3 submitted (Java)', color: 'var(--success)' },
      { time: '10:39:55', msg: 'Suresh Babu — Violation #2 recorded (tab switch)', color: 'var(--warning)' },
      { time: '10:38:14', msg: 'Arjun Sharma — Q1 executed (Python) — Accepted', color: 'var(--accent)' },
      { time: '10:37:02', msg: 'Kiran Patel — Test session started', color: 'var(--accent2)' },
    ];
    el.innerHTML = events.map(e =>
      `<div><span style="color:var(--text3);font-family:monospace;font-size:11px">${e.time}</span>
       &nbsp;&nbsp;<span style="color:${e.color}">${Utils.escapeHtml(e.msg)}</span></div>`
    ).join('');
  }

  /* ════════════════════════════════════════════════════════
     SECTION: STUDENTS
     ════════════════════════════════════════════════════════ */
  function _renderStudents() {
    const content = Utils.$('adminContent');
    content.innerHTML = `
      <div class="section-title">Student Monitoring</div>
      <div class="section-sub">Live status of all registered students — Click a row to view details</div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <input type="text" id="stSearchInput" placeholder="Search by name, USN, email…" oninput="AdminPortal.filterStudents()">
          <select id="stStatusFilter" onchange="AdminPortal.filterStudents()"
            style="background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 12px;font-size:12px;font-family:inherit;outline:none">
            <option value="">All Status</option>
            <option value="live">Live</option>
            <option value="submitted">Submitted</option>
            <option value="flagged">Flagged</option>
            <option value="not started">Not Started</option>
          </select>
          <button class="btn btn-outline btn-sm" onclick="AdminPortal.exportStudents()">📥 Export CSV</button>
          <button class="btn btn-blue btn-sm" onclick="AdminPortal.terminateAllFlagged()">🚫 Terminate Flagged</button>
        </div>
        <table class="data-table">
          <thead><tr>
            <th>NAME</th><th>USN</th><th>COLLEGE EMAIL</th>
            <th>IP ADDRESS</th><th>STATUS</th><th>SCORE</th>
            <th>VIOLATIONS</th><th>TIME LEFT</th><th>ACTIONS</th>
          </tr></thead>
          <tbody id="studentTableBody"></tbody>
        </table>
      </div>
    `;
    _renderStudentTable();
  }

  function _renderStudentTable() {
    const tbody = Utils.$('studentTableBody');
    if (!tbody) return;

    const q  = (Utils.$('stSearchInput')  || {}).value?.toLowerCase() || '';
    const st = (Utils.$('stStatusFilter') || {}).value || '';

    const filtered = MOCK_STUDENTS.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchS = !st || s.status === st;
      return matchQ && matchS;
    });

    const statusInfo = {
      live:          { dot: 'dot-green',  label: 'Live' },
      submitted:     { dot: 'dot-blue',   label: 'Submitted' },
      flagged:       { dot: 'dot-red',    label: 'Flagged' },
      'not started': { dot: 'dot-gray',   label: 'Not Started' },
    };

    tbody.innerHTML = filtered.map(s => {
      const si = statusInfo[s.status] || { dot: 'dot-gray', label: s.status };
      const violationColor = s.violations >= 3 ? 'var(--danger)' : s.violations > 0 ? 'var(--warning)' : 'var(--success)';
      return `<tr>
        <td style="font-weight:500">${Utils.escapeHtml(s.name)}</td>
        <td style="color:var(--text2);font-family:monospace">${Utils.escapeHtml(s.usn)}</td>
        <td style="color:var(--text2)">${Utils.escapeHtml(s.email)}</td>
        <td style="color:var(--text3);font-family:monospace;font-size:11px">${Utils.escapeHtml(s.ip)}</td>
        <td><span class="status-dot ${si.dot}"></span>${si.label}</td>
        <td style="color:var(--accent);font-weight:600">${s.score !== null ? s.score + '/' + QUESTIONS.reduce((a,q)=>a+q.marks,0) : '—'}</td>
        <td style="color:${violationColor};font-weight:${s.violations > 0 ? '600' : '400'}">${s.violations}</td>
        <td style="color:var(--text2);font-family:monospace">${Utils.escapeHtml(s.timeLeft)}</td>
        <td style="display:flex;gap:5px">
          ${s.status === 'live' ? `<button class="btn btn-sm btn-danger" onclick="AdminPortal.terminateStudent('${Utils.escapeHtml(s.usn)}')">Terminate</button>` : ''}
          ${s.status === 'flagged' ? `<button class="btn btn-sm" style="background:var(--warning);color:#000;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:600;border:none;cursor:pointer">Review</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">No students found</td></tr>`;
    }
  }

  function filterStudents() { _renderStudentTable(); }

  function exportStudents() {
    const rows = MOCK_STUDENTS.map(s => ({
      Name: s.name, USN: s.usn, Email: s.email, Phone: s.phone,
      IP: s.ip, Status: s.status, Score: s.score ?? '—',
      Violations: s.violations, TimeLeft: s.timeLeft, Language: s.lang,
    }));
    Utils.exportCSV(rows, 'codeproct_students.csv');
    Utils.toast('Student data exported as CSV', 'success');
  }

  function terminateStudent(usn) {
    Utils.confirm(
      `Terminate test session for USN ${usn}? Their current answers will be auto-submitted.`,
      () => Utils.toast(`Session terminated: ${usn}`, 'danger')
    );
  }

  function terminateAllFlagged() {
    const flagged = MOCK_STUDENTS.filter(s => s.status === 'flagged');
    Utils.confirm(
      `Terminate all ${flagged.length} flagged student sessions? Their answers will be auto-submitted.`,
      () => Utils.toast(`${flagged.length} sessions terminated.`, 'danger')
    );
  }

  /* ════════════════════════════════════════════════════════
     SECTION: RESULTS
     ════════════════════════════════════════════════════════ */
  function _renderResults() {
    const content = Utils.$('adminContent');
    const totalMarks = QUESTIONS.reduce((s, q) => s + q.marks, 0);

    content.innerHTML = `
      <div class="section-title">Results & Analytics</div>
      <div class="section-sub">Submitted results are automatically saved to the Excel sheet</div>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="AdminPortal.exportResults()">📥 Export All Results (Excel)</button>
        <button class="btn btn-outline" onclick="AdminPortal.exportResults()">📊 Download PDF Report</button>
        <button class="btn btn-outline btn-sm" onclick="AdminPortal.toggleShowAll()" id="showAllBtn">Show All Students</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>RANK</th><th>STUDENT NAME</th><th>USN</th>
            <th>SCORE</th><th>PERCENTAGE</th><th>GRADE</th>
            <th>TIME TAKEN</th><th>VIOLATIONS</th><th>LANG</th><th>SUBMITTED AT</th>
          </tr></thead>
          <tbody>
            ${MOCK_RESULTS.map((r, i) => `<tr>
              <td style="font-weight:700;color:var(--text2)">#${i + 1}</td>
              <td style="font-weight:500">${Utils.escapeHtml(r.name)}</td>
              <td style="color:var(--text2);font-family:monospace">${Utils.escapeHtml(r.usn)}</td>
              <td style="color:var(--accent);font-weight:700">${r.score}/${totalMarks}</td>
              <td>
                <div style="font-size:12px;font-weight:600;margin-bottom:2px">${r.pct}%</div>
                <div class="progress-bar" style="width:80px">
                  <div class="progress-fill" style="width:${r.pct}%;background:${r.pct>=80?'var(--success)':r.pct>=50?'var(--accent3)':'var(--danger)'}"></div>
                </div>
              </td>
              <td><span class="rank-badge rank-${r.rank}">${r.rank}</span></td>
              <td style="font-family:monospace;color:var(--text2)">${r.time}</td>
              <td style="color:${r.violations>0?'var(--danger)':'var(--success)'}">${r.violations}</td>
              <td>${r.lang}</td>
              <td style="color:var(--text3);font-family:monospace;font-size:11px">${r.submittedAt}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function exportResults() {
    const totalMarks = QUESTIONS.reduce((s, q) => s + q.marks, 0);
    const rows = MOCK_RESULTS.map(r => ({
      Name: r.name, USN: r.usn, Score: `${r.score}/${totalMarks}`,
      Percentage: `${r.pct}%`, Grade: r.rank, TimeTaken: r.time,
      Violations: r.violations, Language: r.lang, SubmittedAt: r.submittedAt,
    }));
    Utils.exportCSV(rows, 'codeproct_results.csv');
    Utils.toast('Results exported as CSV (Excel-compatible)', 'success');
  }

  /* ════════════════════════════════════════════════════════
     SECTION: QUESTIONS
     ════════════════════════════════════════════════════════ */
  function _renderQuestions() {
    const content = Utils.$('adminContent');
    content.innerHTML = `
      <div class="section-title">Manage Questions</div>
      <div class="section-sub">Configure questions, marks, and per-question language restrictions</div>
      <div id="questionEditorList"></div>
      <button class="btn btn-primary" onclick="AdminPortal.addQuestion()" style="margin-top:4px">+ Add Question</button>
    `;
    _renderQuestionList();
  }

  function _renderQuestionList() {
    const list = Utils.$('questionEditorList');
    if (!list) return;

    const totalMarks = App.state.questions.reduce((s, q) => s + q.marks, 0);

    list.innerHTML = App.state.questions.map((q, i) => {
      const locked = q.allowed_langs.length === 1;
      return `
        <div class="q-editor-card">
          <div class="q-editor-header">
            <div class="q-editor-header-left">
              <div class="q-num-badge">Q${i + 1}</div>
              <span>${Utils.escapeHtml(q.title)}</span>
              ${locked ? `<span style="font-size:10px;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:2px 7px;border-radius:4px">🔒 ${q.allowed_langs[0].toUpperCase()} ONLY</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:11px;color:var(--accent3);font-weight:600">⭐ ${q.marks} marks</span>
              <button class="btn btn-outline btn-sm" onclick="AdminPortal.toggleQEditor(${i})">Edit ▾</button>
              <button class="btn btn-sm" style="background:var(--danger);color:#fff;padding:5px 10px;font-size:11px" onclick="AdminPortal.removeQuestion(${i})">✕</button>
            </div>
          </div>
          <div class="q-editor-body" id="qEditor_${i}" style="display:none">
            <div class="admin-form-row">
              <div class="admin-field full">
                <label>QUESTION TITLE</label>
                <input type="text" value="${Utils.escapeHtml(q.title)}" id="qtitle_${i}" oninput="AdminPortal.updateQ(${i})">
              </div>
            </div>
            <div class="admin-form-row">
              <div class="admin-field full">
                <label>DESCRIPTION</label>
                <textarea id="qdesc_${i}" rows="4" oninput="AdminPortal.updateQ(${i})">${Utils.escapeHtml(q.description)}</textarea>
              </div>
            </div>
            <div class="admin-form-row">
              <div class="admin-field">
                <label>MARKS</label>
                <input type="number" value="${q.marks}" min="1" max="100" id="qmarks_${i}" oninput="AdminPortal.updateQ(${i})">
              </div>
              <div class="admin-field">
                <label>TIME LIMIT (seconds)</label>
                <input type="number" value="${q.time_limit_seconds}" min="1" max="30" id="qtime_${i}">
              </div>
            </div>

            <!-- Language Restriction -->
            <div style="margin-bottom:14px">
              <label style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.8px;display:block;margin-bottom:8px">ALLOWED LANGUAGES</label>
              <div class="lang-check-group">
                ${['python', 'java', 'cpp'].map(lang => `
                  <label class="lang-check ${q.allowed_langs.length === 1 && q.allowed_langs[0] === lang ? 'locked' : ''}">
                    <input type="checkbox" ${q.allowed_langs.includes(lang) ? 'checked' : ''}
                      onchange="AdminPortal.toggleQLang(${i}, '${lang}', this.checked)">
                    ${{ python: 'Python', java: 'Java', cpp: 'C++' }[lang]}
                  </label>
                `).join('')}
              </div>
              ${locked
                ? `<div class="q-lang-lock-note">🔒 Locked to ${q.allowed_langs[0].toUpperCase()} — students cannot choose another language</div>`
                : `<div style="font-size:11px;color:var(--success);margin-top:6px">✓ Multiple languages allowed — student may choose</div>`
              }
            </div>

            <!-- Test Cases -->
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.8px;display:block;margin-bottom:8px">TEST CASES</label>
              ${q.test_cases.map((tc, ti) => `
                <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start">
                  <div style="flex:1">
                    <input type="text" value="${Utils.escapeHtml(tc.input)}" placeholder="Input"
                      style="width:100%;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 10px;font-family:monospace;font-size:11px;outline:none;margin-bottom:4px">
                    <input type="text" value="${Utils.escapeHtml(tc.expected_output)}" placeholder="Expected Output"
                      style="width:100%;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 10px;font-family:monospace;font-size:11px;outline:none">
                  </div>
                  <div style="display:flex;flex-direction:column;gap:4px;padding-top:4px">
                    <label style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:4px;cursor:pointer">
                      <input type="checkbox" ${tc.is_hidden ? 'checked' : ''}> Hidden
                    </label>
                  </div>
                </div>
              `).join('')}
              <button class="btn btn-outline btn-sm" onclick="AdminPortal.addTestCase(${i})">+ Add Test Case</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Total marks display
    const totalEl = document.createElement('div');
    totalEl.style.cssText = 'text-align:right;font-size:12px;color:var(--text2);margin-bottom:12px';
    totalEl.innerHTML = `Total marks: <strong style="color:var(--accent)">${totalMarks}</strong>`;
    list.insertBefore(totalEl, list.firstChild);
  }

  function toggleQEditor(i) {
    const body = Utils.$(`qEditor_${i}`);
    if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }

  function updateQ(i) {
    const q = App.state.questions[i];
    q.title       = (Utils.$(`qtitle_${i}`)  || {}).value || q.title;
    q.description = (Utils.$(`qdesc_${i}`)   || {}).value || q.description;
    q.marks       = parseInt((Utils.$(`qmarks_${i}`) || {}).value) || q.marks;
    _renderQuestionList();
    // Re-open the editor
    const body = Utils.$(`qEditor_${i}`);
    if (body) body.style.display = 'block';
  }

  function toggleQLang(i, lang, checked) {
    const q = App.state.questions[i];
    if (checked) {
      if (!q.allowed_langs.includes(lang)) q.allowed_langs.push(lang);
    } else {
      const next = q.allowed_langs.filter(l => l !== lang);
      if (next.length === 0) { Utils.toast('At least one language must be allowed.', 'warning'); return; }
      q.allowed_langs = next;
    }
    _renderQuestionList();
    const body = Utils.$(`qEditor_${i}`);
    if (body) body.style.display = 'block';
  }

  function addQuestion() {
    App.state.questions.push({
      id:    App.state.questions.length + 1,
      title: 'New Question ' + (App.state.questions.length + 1),
      description: 'Describe the problem statement here.',
      marks: 10,
      time_limit_seconds: 2,
      allowed_langs: ['python', 'java', 'cpp'],
      test_cases: [{ input: '', expected_output: '', is_hidden: false }],
      examples: [{ input: '', output: '' }],
    });
    _renderQuestionList();
    Utils.toast('New question added.', 'success');
  }

  function removeQuestion(i) {
    if (App.state.questions.length <= 1) {
      Utils.toast('At least one question is required.', 'warning');
      return;
    }
    Utils.confirm(`Remove question ${i + 1}: "${App.state.questions[i].title}"?`, () => {
      App.state.questions.splice(i, 1);
      _renderQuestionList();
      Utils.toast('Question removed.', 'info');
    });
  }

  function addTestCase(qi) {
    App.state.questions[qi].test_cases.push({ input: '', expected_output: '', is_hidden: false });
    _renderQuestionList();
    const body = Utils.$(`qEditor_${qi}`);
    if (body) body.style.display = 'block';
  }

  /* ════════════════════════════════════════════════════════
     SECTION: SETTINGS
     ════════════════════════════════════════════════════════ */
  function _renderSettings() {
    const content = Utils.$('adminContent');
    const cfg = App.state.testConfig;

    content.innerHTML = `
      <div class="section-title">Test Configuration</div>
      <div class="section-sub">Configure proctoring options, timing, and security rules</div>

      <!-- Timing -->
      <div class="admin-card">
        <div class="admin-card-title">⏱ Test Timing</div>
        <div class="admin-form-row">
          <div class="admin-field">
            <label>DURATION (MINUTES)</label>
            <input type="number" id="cfgDuration" value="${cfg.duration_minutes}" min="5" max="360">
          </div>
          <div class="admin-field">
            <label>MAX VIOLATIONS BEFORE TERMINATE</label>
            <input type="number" id="cfgMaxViol" value="${cfg.max_violations_before_terminate}" min="1" max="20">
          </div>
        </div>
        <div class="admin-form-row">
          <div class="admin-field">
            <label>SCHEDULED START DATE & TIME</label>
            <input type="datetime-local" id="cfgStartTime">
          </div>
          <div class="admin-field">
            <label>ACCESS CODE (optional)</label>
            <input type="text" id="cfgAccessCode" placeholder="Leave blank for open access">
          </div>
        </div>
      </div>

      <!-- Proctoring -->
      <div class="admin-card">
        <div class="admin-card-title">🔒 Proctoring & Security Settings</div>

        ${_toggleRow('togVideo', 'Video Proctoring', 'Enable live webcam monitoring during the test', cfg.video_proctoring)}
        ${_toggleRow('togIP', 'IP Address Tracking', 'Log and track device IP for every student (mandatory)', true, true)}
        ${_toggleRow('togTab', 'Tab Switch Detection', 'Flag and record violations on window/tab change', cfg.tab_switch_detection)}
        ${_toggleRow('togPaste', 'Copy / Paste Blocking', 'Block Ctrl+C, Ctrl+V, right-click in the code editor', cfg.copy_paste_blocked)}
        ${_toggleRow('togFS', 'Fullscreen Enforcement', 'Force test into fullscreen; warn and re-enter on exit', cfg.fullscreen_required)}
        ${_toggleRow('togGoogle', 'Google Sign-in Required', 'Mandatory Google OAuth before test access (mandatory)', true, true)}
        ${_toggleRow('togMobile', 'Block Mobile & Tablets', 'Reject access from non-desktop device types (mandatory)', true, true)}
      </div>

      <!-- Language defaults -->
      <div class="admin-card">
        <div class="admin-card-title">💻 Global Default Languages</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
          These are the default allowed languages for new questions. Override per-question in the Questions tab.
        </div>
        <div class="lang-check-group">
          <label class="lang-check"><input type="checkbox" id="glPython" checked> Python</label>
          <label class="lang-check"><input type="checkbox" id="glJava"   checked> Java</label>
          <label class="lang-check"><input type="checkbox" id="glCpp"    checked> C++</label>
        </div>
      </div>

      <!-- Grading -->
      <div class="admin-card">
        <div class="admin-card-title">⭐ Grading & Scoring</div>
        <div class="admin-form-row-3">
          <div class="admin-field">
            <label>FULL PASS MARKS (%)</label>
            <input type="number" value="100" min="1" max="100">
          </div>
          <div class="admin-field">
            <label>PARTIAL PASS MARKS (%)</label>
            <input type="number" value="50" min="1" max="100">
          </div>
          <div class="admin-field">
            <label>PENALTY PER VIOLATION (%)</label>
            <input type="number" value="0" min="0" max="20">
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" onclick="AdminPortal.saveSettings()">💾 Save All Settings</button>
        <button class="btn btn-outline" onclick="AdminPortal.previewTest()">👁 Preview Test</button>
      </div>
    `;
  }

  function _toggleRow(id, label, desc, checked, disabled = false) {
    return `
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">${label}</div>
          <div class="toggle-desc">${desc}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
          <div class="toggle-slider"></div>
        </label>
      </div>
    `;
  }

  function saveSettings() {
    const cfg = App.state.testConfig;
    cfg.duration_minutes                 = parseInt((Utils.$('cfgDuration') || {}).value) || 45;
    cfg.max_violations_before_terminate  = parseInt((Utils.$('cfgMaxViol')  || {}).value) || 5;
    cfg.video_proctoring    = (Utils.$('togVideo') || {}).checked;
    cfg.tab_switch_detection = (Utils.$('togTab')  || {}).checked;
    cfg.copy_paste_blocked  = (Utils.$('togPaste') || {}).checked;
    cfg.fullscreen_required = (Utils.$('togFS')    || {}).checked;
    Utils.toast('✓ Settings saved successfully!', 'success');
  }

  function previewTest() {
    Utils.toast('Preview mode: opens test as read-only — not implemented in demo.', 'info');
  }

  /* ════════════════════════════════════════════════════════
     SECTION: UPLOAD
     ════════════════════════════════════════════════════════ */
  function _renderUpload() {
    const content = Utils.$('adminContent');
    content.innerHTML = `
      <div class="section-title">Upload Assessment Excel</div>
      <div class="section-sub">Admin credentials, questions, test config, and student list in one sheet</div>

      <div class="admin-card">
        <div class="admin-card-title">📋 Expected Excel Sheet Structure</div>
        <div style="font-size:12px;color:var(--text2);line-height:2">
          <strong style="color:#fff">Sheet 1 — Admin Credentials:</strong>
          email, password, name, role<br>
          <strong style="color:#fff">Sheet 2 — Questions:</strong>
          id, title, description, marks, allowed_languages (comma-separated), time_limit_seconds, sample_input, sample_output<br>
          <strong style="color:#fff">Sheet 3 — Test Config:</strong>
          duration_minutes, start_datetime, video_proctoring, tab_detection, paste_blocked, fullscreen, access_code<br>
          <strong style="color:#fff">Sheet 4 — Registered Students (optional pre-load):</strong>
          name, usn, phone, college_email, google_email<br>
          <strong style="color:#fff">Sheet 5 — Results (auto-populated after test):</strong>
          name, usn, score, rank, time_taken, violations, language, submitted_at
        </div>
      </div>

      <div class="admin-card upload-zone" id="uploadZone"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="AdminPortal.handleFileDrop(event)">
        <div class="upload-icon">📤</div>
        <div class="upload-title">Drag & Drop Excel File Here</div>
        <div class="upload-sub">Supports .xlsx, .xls, and .csv formats</div>
        <input type="file" id="excelFileInput" accept=".xlsx,.xls,.csv" style="display:none" onchange="AdminPortal.handleFileSelect(this)">
        <button class="btn btn-primary" onclick="document.getElementById('excelFileInput').click()">Browse File</button>
        <div class="upload-status" id="uploadStatus"></div>
      </div>

      <div class="admin-card" style="margin-top:14px">
        <div class="admin-card-title">📥 Export Templates</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="AdminPortal.downloadTemplate('questions')">Questions Template</button>
          <button class="btn btn-outline btn-sm" onclick="AdminPortal.downloadTemplate('students')">Students Template</button>
          <button class="btn btn-outline btn-sm" onclick="AdminPortal.downloadTemplate('config')">Config Template</button>
          <button class="btn btn-outline btn-sm" onclick="AdminPortal.downloadTemplate('full')">Full Template (.xlsx)</button>
        </div>
      </div>
    `;
  }

  function handleFileDrop(e) {
    e.preventDefault();
    Utils.$('uploadZone')?.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) _processFile(file);
  }

  function handleFileSelect(input) {
    if (input.files[0]) _processFile(input.files[0]);
  }

  function _processFile(file) {
    const status = Utils.$('uploadStatus');
    if (!status) return;
    if (!file.name.match(/\.(xlsx?|csv)$/i)) {
      status.style.color = 'var(--danger)';
      status.textContent = '❌ Invalid file type. Please upload an .xlsx or .csv file.';
      return;
    }
    status.style.color = 'var(--accent3)';
    status.textContent = `⏳ Processing "${file.name}" …`;
    setTimeout(() => {
      status.style.color = 'var(--success)';
      status.textContent = `✓ "${file.name}" loaded successfully — 3 questions, ${MOCK_STUDENTS.length} students registered, admin credentials verified.`;
      Utils.toast('Excel file processed successfully!', 'success');
    }, 1400);
  }

  function downloadTemplate(type) {
    const templates = {
      questions: [{ id:1, title:'FizzBuzz', description:'...', marks:10, allowed_languages:'python,java,cpp', time_limit_seconds:2, sample_input:'5', sample_output:'1\n2\nFizz\n4\nBuzz' }],
      students:  [{ name:'John Doe', usn:'1XX21CS001', phone:'+919876543210', college_email:'john@college.edu', google_email:'john@gmail.com' }],
      config:    [{ duration_minutes:45, start_datetime:'2025-06-01 10:00:00', video_proctoring:true, tab_detection:true, paste_blocked:true, fullscreen:true, access_code:'' }],
      full:      [{ note:'Use Sheet 1 for Admin, Sheet 2 for Questions, Sheet 3 for Config, Sheet 4 for Students, Sheet 5 will be auto-filled with results' }],
    };
    Utils.exportCSV(templates[type] || [], `codeproct_template_${type}.csv`);
    Utils.toast(`${type} template downloaded.`, 'success');
  }

  return {
    init,
    destroy,
    navTo,
    filterStudents,
    exportStudents,
    terminateStudent,
    terminateAllFlagged,
    exportResults,
    toggleQEditor,
    updateQ,
    toggleQLang,
    addQuestion,
    removeQuestion,
    addTestCase,
    saveSettings,
    previewTest,
    handleFileDrop,
    handleFileSelect,
    downloadTemplate,
  };
})();
