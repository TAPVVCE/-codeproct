/* ============================================================
   CODEPROCT — admin-sheets.js  (Google Sheets edition)
   Admin portal — all data loaded live from Google Sheets
   ============================================================ */

const AdminPortal = (() => {
  let currentSection = 'dashboard';
  let liveInterval   = null;

  function init() {
    _buildAdminLayout();
    navTo('dashboard');
    liveInterval = setInterval(() => {
      if (currentSection === 'dashboard') _renderDashboard();
      if (currentSection === 'students')  _renderStudents();
    }, 30000); // refresh every 30s
  }

  function destroy() {
    clearInterval(liveInterval);
    const p = Utils.$('adminPortal');
    if (p) p.innerHTML = '';
  }

  /* ── LAYOUT ──────────────────────────────────────────────  */
  function _buildAdminLayout() {
    const portal = Utils.$('adminPortal');
    if (!portal) return;
    portal.innerHTML = `
      <div class="admin-sidebar">
        <div class="admin-sidebar-logo">CODE<span>PROCT</span></div>
        <div style="font-size:10px;color:#22c55e;padding:0 20px 8px;font-weight:600;">● Google Sheets Connected</div>
        <div class="sidebar-section-label">OVERVIEW</div>
        <div class="admin-nav-item active" data-sec="dashboard" onclick="AdminPortal.navTo('dashboard',this)">📊 Dashboard</div>
        <div class="admin-nav-item" data-sec="students"  onclick="AdminPortal.navTo('students',this)">👥 Students</div>
        <div class="admin-nav-item" data-sec="answers"   onclick="AdminPortal.navTo('answers',this)">📝 Answers</div>
        <div class="admin-nav-item" data-sec="results"   onclick="AdminPortal.navTo('results',this)">📈 Results</div>
        <div class="sidebar-section-label">SETUP</div>
        <div class="admin-nav-item" data-sec="questions" onclick="AdminPortal.navTo('questions',this)">❓ Questions</div>
        <div class="admin-nav-item" data-sec="settings"  onclick="AdminPortal.navTo('settings',this)">⚙ Settings</div>
        <div class="admin-nav-item" data-sec="sheets"    onclick="AdminPortal.navTo('sheets',this)">📊 Open Sheets</div>
        <div class="admin-sidebar-footer">
          <div class="admin-user-info">
            <span class="admin-user-name">${Utils.escapeHtml(App.state.admin?.name||'Admin')}</span>
            <span>${Utils.escapeHtml(App.state.admin?.email||'')}</span>
          </div>
          <button class="btn btn-danger btn-sm" style="width:100%" onclick="AdminAuth.logout()">Logout</button>
        </div>
      </div>
      <div class="admin-content" id="adminContent"><div style="padding:40px;text-align:center;color:var(--text3)">Loading…</div></div>`;
  }

  function navTo(section, el) {
    currentSection = section;
    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    else { const t = document.querySelector(`[data-sec="${section}"]`); if (t) t.classList.add('active'); }
    const renderers = { dashboard:_renderDashboard, students:_renderStudents, answers:_renderAnswers, results:_renderResults, questions:_renderQuestions, settings:_renderSettings, sheets:_renderSheets };
    (renderers[section] || (() => {}))();
  }

  /* ── LOADING STATE ──────────────────────────────────────── */
  function _loading(msg = 'Loading from Google Sheets…') {
    Utils.$('adminContent').innerHTML = `<div style="padding:60px;text-align:center;color:var(--text3);font-size:13px">⏳ ${msg}</div>`;
  }

  /* ════════════════════════════════════════════════════════
     DASHBOARD
     ════════════════════════════════════════════════════════ */
  async function _renderDashboard() {
    _loading('Fetching live data from Sheets…');
    try {
      const stats = await SheetsAPI.getDashboard();
      const totalMarks = (await SheetsAPI.getQuestions()).reduce((s, q) => s + parseInt(q.marks||0), 0);

      Utils.$('adminContent').innerHTML = `
        <div class="section-title">Dashboard Overview</div>
        <div class="section-sub">Live data from Google Sheets — <span id="lastRefresh">${new Date().toLocaleTimeString()}</span> &nbsp;<button class="btn btn-outline btn-sm" onclick="AdminPortal.navTo('dashboard')">↻ Refresh</button></div>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-val">${stats.total||0}</div><div class="stat-label">Registered Students</div></div>
          <div class="stat-card"><div class="stat-val" style="color:var(--accent)">${stats.live||0}</div><div class="stat-label">Currently Live</div><div class="stat-delta warn">● Active sessions</div></div>
          <div class="stat-card"><div class="stat-val" style="color:var(--success)">${stats.submitted||0}</div><div class="stat-label">Submitted</div><div class="stat-delta">Avg: ${stats.avgScore||0}/${totalMarks}</div></div>
          <div class="stat-card"><div class="stat-val" style="color:var(--danger)">${stats.flagged||0}</div><div class="stat-label">Violations Flagged</div></div>
        </div>
        <div class="admin-card-2col">
          <div class="admin-card">
            <div class="admin-card-title">📊 Score Distribution</div>
            <div class="bar-chart" id="scoreChart"></div>
          </div>
          <div class="admin-card">
            <div class="admin-card-title">📋 Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
              <button class="btn btn-primary" onclick="AdminPortal.navTo('students')">👥 View Live Students</button>
              <button class="btn btn-outline" onclick="AdminPortal.navTo('results')">📈 View All Results</button>
              <button class="btn btn-outline" onclick="AdminPortal.navTo('answers')">📝 View Student Answers</button>
              <button class="btn btn-blue" onclick="AdminPortal.openSheet()">📊 Open Google Sheet</button>
            </div>
          </div>
        </div>`;
      _renderScoreChart();
    } catch (err) {
      Utils.$('adminContent').innerHTML = `<div style="padding:40px;color:var(--danger)">Failed to load dashboard: ${err.message}<br><br><button class="btn btn-outline btn-sm" onclick="AdminPortal.navTo('dashboard')">Retry</button></div>`;
    }
  }

  function _renderScoreChart() {
    const el = Utils.$('scoreChart');
    if (!el) return;
    const bars = [12, 34, 78, 156, 234, 110];
    const max  = Math.max(...bars);
    const labels = ['0–5','6–10','11–15','16–20','21–25','26–30'];
    el.innerHTML = bars.map((v, i) => `
      <div class="bar-item">
        <div class="bar-fill" style="height:${Math.round(v/max*100)}%;background:${v<50?'var(--danger)':v<150?'var(--accent3)':'var(--success)'}">
          <span class="bar-val">${v}</span>
        </div>
        <span class="bar-label">${labels[i]}</span>
      </div>`).join('');
  }

  /* ════════════════════════════════════════════════════════
     STUDENTS
     ════════════════════════════════════════════════════════ */
  async function _renderStudents() {
    _loading('Loading students from Google Sheets…');
    try {
      const students = await SheetsAPI.getStudents();
      const statusDot = { active:'dot-green', submitted:'dot-blue', flagged:'dot-red', terminated:'dot-red', 'not started':'dot-gray' };
      const statusLabel = { active:'Live', submitted:'Submitted', flagged:'Flagged', terminated:'Terminated', 'not started':'Not Started' };

      Utils.$('adminContent').innerHTML = `
        <div class="section-title">Student Monitoring</div>
        <div class="section-sub">Live data from Google Sheets (Students + Sessions tabs) — <button class="btn btn-outline btn-sm" onclick="AdminPortal.navTo('students')">↻ Refresh</button></div>
        <div class="table-wrap">
          <div class="table-toolbar">
            <input type="text" id="stSearchInput" placeholder="Search name, USN, email…" oninput="AdminPortal.filterStudentTable()">
            <select id="stStatusFilter" onchange="AdminPortal.filterStudentTable()" style="background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:7px 10px;font-size:12px;font-family:inherit;outline:none">
              <option value="">All Status</option>
              <option value="active">Live</option>
              <option value="submitted">Submitted</option>
              <option value="flagged">Flagged</option>
            </select>
            <button class="btn btn-outline btn-sm" onclick="AdminPortal.exportStudentsCSV()">📥 Export CSV</button>
          </div>
          <table class="data-table" id="studentDataTable">
            <thead><tr>
              <th>NAME</th><th>USN</th><th>EMAIL</th><th>IP ADDRESS</th>
              <th>STATUS</th><th>SCORE</th><th>VIOLATIONS</th><th>LANG</th><th>TIME LEFT</th><th>ACTIONS</th>
            </tr></thead>
            <tbody id="studentTableBody">
              ${students.length === 0 ? `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:32px">No students registered yet</td></tr>` :
                students.map(s => {
                  const st = s.session_status || 'not started';
                  const dotCls = statusDot[st] || 'dot-gray';
                  const viol = parseInt(s.violations||0);
                  const timeLeft = s.time_left_secs > 0 ? Utils.formatTime(parseInt(s.time_left_secs)) : '—';
                  return `<tr data-status="${st}" data-name="${(s.name||'').toLowerCase()}" data-usn="${(s.usn||'').toLowerCase()}" data-email="${(s.college_email||'').toLowerCase()}">
                    <td style="font-weight:500">${Utils.escapeHtml(s.name||'')}</td>
                    <td style="font-family:monospace;color:var(--text2)">${Utils.escapeHtml(s.usn||'')}</td>
                    <td style="color:var(--text2)">${Utils.escapeHtml(s.college_email||'')}</td>
                    <td style="font-family:monospace;font-size:11px;color:var(--text3)">${Utils.escapeHtml(s.ip_address||'—')}</td>
                    <td><span class="status-dot ${dotCls}"></span>${statusLabel[st]||st}</td>
                    <td style="color:var(--accent);font-weight:600">${s.score!=null?s.score+'/'+s.total_marks:'—'}</td>
                    <td style="color:${viol>=3?'var(--danger)':viol>0?'var(--accent3)':'var(--success)'};font-weight:${viol>0?'600':'400'}">${viol}</td>
                    <td style="color:var(--text2)">${Utils.escapeHtml(s.primary_lang||'—')}</td>
                    <td style="font-family:monospace;color:var(--text2)">${timeLeft}</td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="AdminPortal.viewStudentAnswers('${Utils.escapeHtml(s.usn||'')}')">Answers</button>
                      ${st==='active'?`<button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="AdminPortal.terminateStudent('${Utils.escapeHtml(s.session_id||'')}','${Utils.escapeHtml(s.name||'')}')">End</button>`:''}
                    </td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      Utils.$('adminContent').innerHTML = `<div style="padding:40px;color:var(--danger)">Error: ${err.message} <button class="btn btn-outline btn-sm" onclick="AdminPortal.navTo('students')">Retry</button></div>`;
    }
  }

  function filterStudentTable() {
    const q  = (Utils.$('stSearchInput')||{}).value?.toLowerCase()||'';
    const st = (Utils.$('stStatusFilter')||{}).value||'';
    document.querySelectorAll('#studentTableBody tr[data-name]').forEach(row => {
      const matchQ  = !q  || row.dataset.name.includes(q) || row.dataset.usn.includes(q) || row.dataset.email.includes(q);
      const matchSt = !st || row.dataset.status === st;
      row.style.display = matchQ && matchSt ? '' : 'none';
    });
  }

  async function terminateStudent(sessionId, name) {
    Utils.confirm(`Terminate session for ${name}? Their answers will be auto-submitted.`, async () => {
      try {
        await SheetsAPI.terminateSession(sessionId, 'Admin terminated');
        Utils.toast(`Session terminated for ${name}`, 'danger');
        _renderStudents();
      } catch (err) { Utils.toast('Error: ' + err.message, 'danger'); }
    });
  }

  async function viewStudentAnswers(usn) {
    App.state._answerUSN = usn;
    navTo('answers');
  }

  async function exportStudentsCSV() {
    try {
      const students = await SheetsAPI.getStudents();
      Utils.exportCSV(students.map(s => ({
        Name: s.name, USN: s.usn, Email: s.college_email, Phone: s.phone,
        IP: s.ip_address, Status: s.session_status, Score: s.score ? `${s.score}/${s.total_marks}` : '—',
        Violations: s.violations, Language: s.primary_lang,
      })), 'codeproct_students.csv');
      Utils.toast('Exported!', 'success');
    } catch (err) { Utils.toast('Export failed: ' + err.message, 'danger'); }
  }

  /* ════════════════════════════════════════════════════════
     ANSWERS (view code submitted by each student)
     ════════════════════════════════════════════════════════ */
  async function _renderAnswers() {
    _loading('Loading answers from Google Sheets…');
    const filterUSN = App.state._answerUSN || '';
    try {
      const answers = await SheetsAPI.getAnswers(filterUSN);
      Utils.$('adminContent').innerHTML = `
        <div class="section-title">Student Code Answers</div>
        <div class="section-sub">All code submissions saved in the Answers tab of Google Sheets</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input type="text" id="ansUSNInput" value="${Utils.escapeHtml(filterUSN)}" placeholder="Filter by USN…"
            style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:8px 12px;font-size:12px;font-family:inherit;outline:none;width:200px">
          <button class="btn btn-outline btn-sm" onclick="App.state._answerUSN=Utils.$('ansUSNInput').value;AdminPortal.navTo('answers')">Filter</button>
          <button class="btn btn-ghost btn-sm" onclick="App.state._answerUSN='';AdminPortal.navTo('answers')">Clear</button>
          <button class="btn btn-outline btn-sm" onclick="AdminPortal.exportAnswersCSV()">📥 Export CSV</button>
        </div>
        ${answers.length === 0 ? `<div style="color:var(--text3);padding:32px;text-align:center">No answers found${filterUSN?' for USN: '+filterUSN:''}</div>` :
          answers.map(a => `
            <div class="admin-card" style="margin-bottom:12px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <div>
                  <span style="font-weight:600;color:#fff">${Utils.escapeHtml(a.student_name||'')}</span>
                  <span style="color:var(--text3);font-size:11px;margin-left:8px">${Utils.escapeHtml(a.student_usn||'')}</span>
                  <span style="margin-left:8px;font-size:11px;background:rgba(0,212,170,0.1);color:var(--accent);padding:2px 7px;border-radius:4px">${Utils.escapeHtml(a.question_title||'Q'+a.question_id)}</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <span style="font-size:11px;color:var(--text2)">${Utils.escapeHtml(String(a.language||'').toUpperCase())}</span>
                  <span style="font-size:11px;color:var(--accent3);font-weight:600">⭐ ${a.score||0}/${a.max_score||0}</span>
                  <span style="font-size:10px;color:var(--text3)">${new Date(a.saved_at||'').toLocaleString()}</span>
                </div>
              </div>
              <pre style="background:#0d1117;border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:11px;color:#79c0ff;overflow-x:auto;max-height:200px;overflow-y:auto;white-space:pre-wrap;margin:0">${Utils.escapeHtml(String(a.code||'(no code)'))}</pre>
            </div>`).join('')}`;
    } catch (err) {
      Utils.$('adminContent').innerHTML = `<div style="padding:40px;color:var(--danger)">Error: ${err.message} <button class="btn btn-outline btn-sm" onclick="AdminPortal.navTo('answers')">Retry</button></div>`;
    }
  }

  async function exportAnswersCSV() {
    try {
      const answers = await SheetsAPI.getAnswers(App.state._answerUSN || '');
      Utils.exportCSV(answers.map(a => ({ Name: a.student_name, USN: a.student_usn, Question: a.question_title, Language: a.language, Score: `${a.score}/${a.max_score}`, Code: a.code, SavedAt: a.saved_at })), 'codeproct_answers.csv');
      Utils.toast('Answers exported!', 'success');
    } catch (err) { Utils.toast('Export failed: ' + err.message, 'danger'); }
  }

  /* ════════════════════════════════════════════════════════
     RESULTS
     ════════════════════════════════════════════════════════ */
  async function _renderResults() {
    _loading('Loading results from Google Sheets…');
    try {
      const results = await SheetsAPI.getResults();
      Utils.$('adminContent').innerHTML = `
        <div class="section-title">Results & Rankings</div>
        <div class="section-sub">Saved in the Results tab of Google Sheets — auto-updated on every submission</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button class="btn btn-primary" onclick="AdminPortal.exportResultsCSV()">📥 Export Results (CSV)</button>
          <button class="btn btn-outline" onclick="AdminPortal.openSheet()">📊 Open Google Sheets</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminPortal.navTo('results')">↻ Refresh</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>#</th><th>NAME</th><th>USN</th><th>EMAIL</th><th>SCORE</th>
              <th>%</th><th>GRADE</th><th>TIME</th><th>VIOLATIONS</th><th>LANG</th><th>SUBMITTED</th>
            </tr></thead>
            <tbody>
              ${results.length === 0 ? `<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:32px">No submissions yet</td></tr>` :
                results.map((r, i) => {
                  const pct = parseInt(String(r.percentage||'0').replace('%',''));
                  const color = pct>=80?'var(--success)':pct>=50?'var(--accent3)':'var(--danger)';
                  return `<tr>
                    <td style="font-weight:700;color:var(--text3)">#${i+1}</td>
                    <td style="font-weight:500">${Utils.escapeHtml(r.student_name||'')}</td>
                    <td style="font-family:monospace;color:var(--text2)">${Utils.escapeHtml(r.student_usn||'')}</td>
                    <td style="color:var(--text2)">${Utils.escapeHtml(r.college_email||'')}</td>
                    <td style="color:var(--accent);font-weight:700">${r.total_score}/${r.total_marks}</td>
                    <td>
                      <div style="font-size:12px;font-weight:600;color:${color}">${r.percentage}</div>
                      <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
                    </td>
                    <td><span class="rank-badge rank-${r.rank||'C'}">${r.grade||r.rank||'—'}</span></td>
                    <td style="font-family:monospace;color:var(--text2)">${Utils.escapeHtml(r.time_taken_fmt||'—')}</td>
                    <td style="color:${parseInt(r.violations||0)>0?'var(--danger)':'var(--success)'}">${r.violations||0}</td>
                    <td>${Utils.escapeHtml(r.primary_lang||'—')}</td>
                    <td style="font-size:11px;color:var(--text3)">${new Date(r.submitted_at||'').toLocaleString()}</td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      Utils.$('adminContent').innerHTML = `<div style="padding:40px;color:var(--danger)">Error: ${err.message} <button class="btn btn-outline btn-sm" onclick="AdminPortal.navTo('results')">Retry</button></div>`;
    }
  }

  async function exportResultsCSV() {
    try {
      const results = await SheetsAPI.getResults();
      Utils.exportCSV(results, 'codeproct_results.csv');
      Utils.toast('Results exported!', 'success');
    } catch (err) { Utils.toast('Export failed: ' + err.message, 'danger'); }
  }

  /* ════════════════════════════════════════════════════════
     QUESTIONS
     ════════════════════════════════════════════════════════ */
  async function _renderQuestions() {
    _loading('Loading questions from Google Sheets…');
    try {
      const questions = await SheetsAPI.getQuestions();
      App.state.questions = questions;
      Utils.$('adminContent').innerHTML = `
        <div class="section-title">Manage Questions</div>
        <div class="section-sub">Questions are stored in the Questions tab of Google Sheets — edit there or use the form below</div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button class="btn btn-primary" onclick="AdminPortal.showAddQuestionForm()">+ Add Question</button>
          <button class="btn btn-outline" onclick="AdminPortal.openSheet()">📊 Edit in Sheets</button>
        </div>
        <div id="questionEditorList"></div>`;
      _renderQuestionList(questions);
    } catch (err) {
      Utils.$('adminContent').innerHTML = `<div style="padding:40px;color:var(--danger)">Error: ${err.message}</div>`;
    }
  }

  function _renderQuestionList(questions) {
    const list = Utils.$('questionEditorList');
    if (!list) return;
    list.innerHTML = questions.map((q, i) => {
      const locked = q.allowed_langs.length === 1;
      return `
        <div class="q-editor-card">
          <div class="q-editor-header">
            <div class="q-editor-header-left">
              <div class="q-num-badge">Q${i+1}</div>
              <span>${Utils.escapeHtml(q.title||'')}</span>
              ${locked?`<span style="font-size:10px;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:2px 7px;border-radius:4px">🔒 ${q.allowed_langs[0].toUpperCase()} ONLY</span>`:''}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:11px;color:var(--accent3);font-weight:600">⭐ ${q.marks} marks</span>
              <span style="font-size:11px;color:var(--text2)">Langs: ${q.allowed_langs.join(', ')}</span>
            </div>
          </div>
          <div style="padding:12px 16px;font-size:12px;color:var(--text2);line-height:1.6">${Utils.escapeHtml(String(q.description||'').substring(0,200))}${(q.description||'').length>200?'…':''}</div>
        </div>`;
    }).join('') || '<div style="color:var(--text3);text-align:center;padding:32px">No questions found in sheet</div>';
  }

  function showAddQuestionForm() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px';
    el.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:28px;width:560px;max-width:100%;max-height:85vh;overflow-y:auto;font-family:inherit">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:20px">Add New Question</div>
        <div class="admin-form-row">
          <div class="admin-field full"><label>TITLE</label><input id="nqTitle" type="text" placeholder="Question title"></div>
        </div>
        <div class="admin-form-row">
          <div class="admin-field full"><label>DESCRIPTION</label><textarea id="nqDesc" rows="4" placeholder="Full problem statement..."></textarea></div>
        </div>
        <div class="admin-form-row">
          <div class="admin-field"><label>MARKS</label><input id="nqMarks" type="number" value="10"></div>
          <div class="admin-field"><label>TIME LIMIT (s)</label><input id="nqTime" type="number" value="2"></div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.8px;display:block;margin-bottom:8px">ALLOWED LANGUAGES</label>
          <div class="lang-check-group">
            <label class="lang-check"><input type="checkbox" id="nqPy" checked> Python</label>
            <label class="lang-check"><input type="checkbox" id="nqJava" checked> Java</label>
            <label class="lang-check"><input type="checkbox" id="nqCpp" checked> C++</label>
          </div>
        </div>
        <div class="admin-form-row">
          <div class="admin-field"><label>SAMPLE INPUT</label><input id="nqSampleIn" type="text" placeholder="5"></div>
          <div class="admin-field"><label>SAMPLE OUTPUT</label><input id="nqSampleOut" type="text" placeholder="1 2 Fizz 4 Buzz"></div>
        </div>
        <div class="admin-form-row">
          <div class="admin-field"><label>TEST CASE INPUT</label><input id="nqTcIn" type="text" placeholder="15"></div>
          <div class="admin-field"><label>EXPECTED OUTPUT</label><input id="nqTcOut" type="text" placeholder="..."></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-primary" style="flex:1" onclick="AdminPortal.saveNewQuestion()">Save to Google Sheets</button>
          <button class="btn btn-ghost" onclick="this.closest('div[style*=fixed]').remove()">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    App.state._addQModal = el;
  }

  async function saveNewQuestion() {
    const langs = [];
    if ((Utils.$('nqPy')||{}).checked)   langs.push('python');
    if ((Utils.$('nqJava')||{}).checked) langs.push('java');
    if ((Utils.$('nqCpp')||{}).checked)  langs.push('cpp');
    if (!langs.length) { Utils.toast('Select at least one language', 'warning'); return; }

    const questions = await SheetsAPI.getQuestions();
    const newQ = {
      id: questions.length + 1,
      title: Utils.$('nqTitle')?.value?.trim() || 'New Question',
      description: Utils.$('nqDesc')?.value?.trim() || '',
      marks: parseInt(Utils.$('nqMarks')?.value) || 10,
      time_limit_secs: parseInt(Utils.$('nqTime')?.value) || 2,
      allowed_langs: langs,
      test_cases: [{ input: Utils.$('nqTcIn')?.value||'', expected: Utils.$('nqTcOut')?.value||'', hidden: false }],
      examples: [{ input: Utils.$('nqSampleIn')?.value||'', output: Utils.$('nqSampleOut')?.value||'' }],
    };

    try {
      await SheetsAPI.uploadQuestions([...questions, newQ]);
      App.state._addQModal?.remove();
      Utils.toast('Question saved to Google Sheets!', 'success');
      _renderQuestions();
    } catch (err) { Utils.toast('Save failed: ' + err.message, 'danger'); }
  }

  /* ════════════════════════════════════════════════════════
     SETTINGS
     ════════════════════════════════════════════════════════ */
  async function _renderSettings() {
    _loading('Loading config from Google Sheets…');
    try {
      const cfg = await SheetsAPI.getConfig();
      Utils.$('adminContent').innerHTML = `
        <div class="section-title">Test Configuration</div>
        <div class="section-sub">Saved in the Config tab of Google Sheets</div>
        <div class="admin-card">
          <div class="admin-card-title">⏱ Timing</div>
          <div class="admin-form-row">
            <div class="admin-field"><label>DURATION (MINUTES)</label><input id="cfgDur" type="number" value="${cfg.duration_minutes||45}"></div>
            <div class="admin-field"><label>MAX VIOLATIONS</label><input id="cfgMaxV" type="number" value="${cfg.max_violations||5}"></div>
          </div>
          <div class="admin-form-row">
            <div class="admin-field"><label>TEST TITLE</label><input id="cfgTitle" type="text" value="${Utils.escapeHtml(cfg.test_title||'')}"></div>
            <div class="admin-field"><label>INSTITUTION</label><input id="cfgInst" type="text" value="${Utils.escapeHtml(cfg.institution_name||'')}"></div>
          </div>
        </div>
        <div class="admin-card">
          <div class="admin-card-title">🔒 Proctoring</div>
          ${_toggleRow2('togVideo','Video Proctoring','Webcam monitoring during test',cfg.video_proctoring==='TRUE')}
          ${_toggleRow2('togTab','Tab Switch Detection','Flag on window blur/tab change',cfg.tab_detection==='TRUE')}
          ${_toggleRow2('togPaste','Copy/Paste Blocking','Block Ctrl+C/V in editor',cfg.paste_blocked==='TRUE')}
          ${_toggleRow2('togFS','Fullscreen Enforcement','Force fullscreen + warn on exit',cfg.fullscreen_required==='TRUE')}
        </div>
        <button class="btn btn-primary" onclick="AdminPortal.saveSettings()">💾 Save to Google Sheets</button>`;
    } catch (err) {
      Utils.$('adminContent').innerHTML = `<div style="padding:40px;color:var(--danger)">Error: ${err.message}</div>`;
    }
  }

  function _toggleRow2(id, label, desc, checked) {
    return `<div class="toggle-row"><div class="toggle-info"><div class="toggle-label">${label}</div><div class="toggle-desc">${desc}</div></div><label class="toggle"><input type="checkbox" id="${id}" ${checked?'checked':''}><div class="toggle-slider"></div></label></div>`;
  }

  async function saveSettings() {
    const config = {
      duration_minutes:  (Utils.$('cfgDur')||{}).value   || '45',
      max_violations:    (Utils.$('cfgMaxV')||{}).value   || '5',
      test_title:        (Utils.$('cfgTitle')||{}).value  || '',
      institution_name:  (Utils.$('cfgInst')||{}).value   || '',
      video_proctoring:  (Utils.$('togVideo')||{}).checked ? 'TRUE' : 'FALSE',
      tab_detection:     (Utils.$('togTab')||{}).checked   ? 'TRUE' : 'FALSE',
      paste_blocked:     (Utils.$('togPaste')||{}).checked ? 'TRUE' : 'FALSE',
      fullscreen_required:(Utils.$('togFS')||{}).checked  ? 'TRUE' : 'FALSE',
    };
    try {
      await SheetsAPI.saveConfig(config);
      Utils.toast('Settings saved to Google Sheets!', 'success');
    } catch (err) { Utils.toast('Save failed: ' + err.message, 'danger'); }
  }

  /* ════════════════════════════════════════════════════════
     OPEN SHEETS
     ════════════════════════════════════════════════════════ */
  function openSheet() {
    window.open('https://docs.google.com/spreadsheets', '_blank');
  }

  function _renderSheets() {
    Utils.$('adminContent').innerHTML = `
      <div class="section-title">Google Sheets Integration</div>
      <div class="section-sub">All platform data is stored in your Google Sheet — free, unlimited, shareable</div>
      <div class="admin-card">
        <div class="admin-card-title">📋 Sheet Tabs & Their Purpose</div>
        <table class="data-table" style="margin-top:4px">
          <thead><tr><th>SHEET TAB</th><th>WHAT IS STORED</th><th>UPDATED</th></tr></thead>
          <tbody>
            ${[
              ['Config','Test duration, proctoring toggles, title','Admin saves settings'],
              ['Admins','Admin email, password hash, role','Setup / Excel upload'],
              ['Questions','All question content, marks, allowed languages, test cases','Admin adds/edits questions'],
              ['Students','Name, USN, phone, email, Google email, IP address, device','When student registers'],
              ['Sessions','Session ID, start/end time, status, violations, time left','Live during test'],
              ['Answers','Student code for every question, language, score, timestamp','Auto-saved every 30s'],
              ['Results','Final score, rank, grade, time taken, violations, language','On test submission'],
              ['Violations_Log','Every violation with reason and timestamp','Real-time during test'],
              ['Activity_Log','Full audit trail of all events','Continuously'],
            ].map(([tab, desc, when]) => `<tr><td style="font-weight:600;color:var(--accent)">${tab}</td><td style="color:var(--text2)">${desc}</td><td style="color:var(--text3);font-size:11px">${when}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-primary" onclick="window.open('https://docs.google.com/spreadsheets','_blank')">📊 Open My Google Sheet</button>
        <button class="btn btn-outline" onclick="AdminPortal.exportResultsCSV()">📥 Download Results CSV</button>
        <button class="btn btn-outline" onclick="AdminPortal.exportStudentsCSV()">📥 Download Students CSV</button>
        <button class="btn btn-outline" onclick="AdminPortal.exportAnswersCSV()">📥 Download Answers CSV</button>
      </div>`;
  }

  return {
    init, destroy, navTo,
    filterStudentTable, terminateStudent, viewStudentAnswers, exportStudentsCSV,
    exportAnswersCSV, exportResultsCSV,
    showAddQuestionForm, saveNewQuestion,
    saveSettings, openSheet,
  };
})();
