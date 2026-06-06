/* ============================================================
   CODEPROCT — test-sheets.js  (Google Sheets edition)
   Proctored test engine — all data saved to Google Sheets
   ============================================================ */

const Test = (() => {

  const state = {
    currentQ:      0,
    answers:       {},   // { qIdx: { lang, code } }
    testLang:      {},
    violations:    0,
    timerInterval: null,
    heartbeatInterval: null,
    autoSaveInterval: null,
    timeLeft:      0,
    startTime:     null,
    active:        false,
    sessionId:     null,
    questions:     [],
  };

  /* ── START ─────────────────────────────────────────────── */
  async function start() {
    // Load questions from Google Sheets
    Utils.toast('Loading test questions…', 'info', 2000);
    try {
      state.questions = await SheetsAPI.getQuestions();
      if (!state.questions.length) throw new Error('No questions found in sheet');
    } catch (err) {
      Utils.toast('Failed to load questions: ' + err.message, 'danger', 0);
      return;
    }

    state.sessionId  = App.state.sessionId;
    state.timeLeft   = App.state.durationSecs || 2700;
    state.startTime  = Date.now();
    state.violations = 0;
    state.answers    = {};
    state.testLang   = {};
    state.active     = true;
    state.currentQ   = 0;

    state.questions.forEach((q, i) => {
      state.testLang[i] = q.allowed_langs[0];
    });

    _buildTestPage();
    _showTestPage();
    _startTimer();
    _setupProctoring();
    _setupVideoProctoring();
    _startAutoSave();
    _startHeartbeat();

    if (true) Utils.enterFullscreen().catch(() => _recordViolation('Fullscreen request denied'));
    loadQuestion(0);
  }

  function resume(saved) { start(); }

  /* ── AUTO-SAVE every 30 seconds ─────────────────────────── */
  function _startAutoSave() {
    state.autoSaveInterval = setInterval(() => {
      if (!state.active) return;
      _saveCurrentAnswer(true); // silent save
    }, 30000);
  }

  /* ── HEARTBEAT every 20 seconds ─────────────────────────── */
  function _startHeartbeat() {
    state.heartbeatInterval = setInterval(() => {
      if (!state.active) return;
      SheetsAPI.sendHeartbeat(state.sessionId, state.timeLeft);
    }, 20000);
  }

  /* ── BUILD TEST PAGE DOM ──────────────────────────────────  */
  function _buildTestPage() {
    let page = Utils.$('testPage');
    if (!page) { page = document.createElement('div'); page.id = 'testPage'; document.body.appendChild(page); }
    const student = App.state.student || {};

    page.innerHTML = `
      <div class="violation-bar" id="violationBar">⚠ VIOLATION DETECTED — Recorded and reported to admin.</div>
      <div class="test-header">
        <div class="test-meta">
          <div class="test-logo">CODE<span>PROCT</span></div>
          <div class="test-qinfo">Q<strong id="testQNum">1</strong>/${state.questions.length} &nbsp;|&nbsp; <strong id="testQMarks">10 marks</strong></div>
          <span class="proc-badge" id="recBadge">🔴 REC</span>
          <span class="proc-badge">📍 ${Utils.escapeHtml(student.ip || '—')}</span>
          <span class="proc-badge" style="background:rgba(0,212,170,0.1);color:#6ee7b7;border-color:rgba(0,212,170,0.2)">📊 Sheets</span>
        </div>
        <div class="test-timer" id="testTimer">${Utils.formatTime(state.timeLeft)}</div>
        <div class="test-actions">
          <span class="student-name-display">${Utils.escapeHtml(student.name || 'Student')}</span>
          <button class="btn btn-success btn-sm" onclick="Test.runCurrentCode()">▶ Run</button>
          <button class="btn btn-danger btn-sm" onclick="Test.confirmSubmit()">Submit All</button>
        </div>
      </div>
      <div class="test-body">
        <div class="question-panel">
          <div class="q-nav-bar" id="qNavBar"></div>
          <div class="q-content" id="qContent"></div>
        </div>
        <div class="code-panel">
          <div class="test-code-header">
            <div class="test-lang-tabs" id="testLangTabs"></div>
            <div class="test-code-meta">
              <span id="currentLangLabel">Python</span>
              <span id="autoSaveStatus" style="color:var(--success);font-size:11px">● Sheets connected</span>
            </div>
          </div>
          <div class="test-editor-wrap">
            <div class="line-numbers" id="testLineNums">1</div>
            <textarea id="testCodeEditor" class="test-code-editor"
              spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
              onkeydown="Test.handleEditorKey(event)"
              oninput="Test.onEditorInput(this)"></textarea>
          </div>
          <div class="test-io">
            <div class="io-pane">
              <div class="io-label">CUSTOM INPUT (optional)</div>
              <textarea id="testInput" class="io-editor" placeholder="Enter custom input..."></textarea>
            </div>
            <div class="io-pane">
              <div class="io-label">OUTPUT <button class="run-btn" id="testRunBtn" onclick="Test.runCurrentCode()">▶ RUN</button></div>
              <div id="testOutput" class="io-output">Output appears here...</div>
            </div>
          </div>
          <div class="test-footer">
            <div class="test-footer-hint">Ctrl+Enter to run &nbsp;|&nbsp; Tab = 4 spaces &nbsp;|&nbsp; Auto-saved to Google Sheets every 30s</div>
            <div class="test-footer-actions">
              <button class="btn btn-ghost btn-sm" onclick="Test.prevQ()">← Prev</button>
              <button class="btn btn-blue btn-sm"  onclick="Test.nextQ()">Next →</button>
            </div>
          </div>
        </div>
      </div>
      <div id="resultPage">
        <div class="result-card">
          <div class="result-eyebrow">ASSESSMENT COMPLETE</div>
          <div class="result-score" id="finalScore">—</div>
          <div class="result-out-of">out of <strong id="totalMarksDisplay">30</strong> marks &nbsp;|&nbsp; <span class="rank-badge" id="rankBadge">—</span></div>
          <div class="result-grid">
            <div class="result-stat"><div class="result-stat-val" id="resSolved">—</div><div class="result-stat-label">Questions Solved</div></div>
            <div class="result-stat"><div class="result-stat-val" id="resTimeTaken">—</div><div class="result-stat-label">Time Taken</div></div>
            <div class="result-stat"><div class="result-stat-val" id="resViolations">0</div><div class="result-stat-label">Violations</div></div>
            <div class="result-stat"><div class="result-stat-val" id="resPrimaryLang">—</div><div class="result-stat-label">Primary Language</div></div>
          </div>
          <div class="result-info-bar">
            ✓ All answers saved to Google Sheets &nbsp;|&nbsp;
            ✓ IP & session logged &nbsp;|&nbsp;
            ✓ Proctoring report saved &nbsp;|&nbsp;
            ✓ Results auto-exported to Sheets
          </div>
          <button class="btn btn-primary btn-block" onclick="Test.backToHome()">Return to Home</button>
        </div>
      </div>`;
  }

  function _showTestPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    Utils.hide('adminPortal');
    App.setNavTest();
    const page = Utils.$('testPage');
    page.classList.add('active');
    page.style.display = 'flex';
  }

  /* ── LOAD QUESTION ─────────────────────────────────────── */
  function loadQuestion(idx) {
    _saveCurrentAnswer();
    state.currentQ = idx;
    const q    = state.questions[idx];
    const lang = state.testLang[idx] || q.allowed_langs[0];

    // Q Nav
    const navBar = Utils.$('qNavBar');
    if (navBar) {
      navBar.innerHTML = state.questions.map((qq, i) => {
        const answered = !!(state.answers[i]?.code?.trim());
        return `<button class="q-nav-btn ${i===idx?'current':''} ${answered?'answered':''}" onclick="Test.saveAndLoad(${i})">${i+1}</button>`;
      }).join('');
    }

    // Q Content
    const qContent = Utils.$('qContent');
    const locked   = q.allowed_langs.length === 1;
    qContent.innerHTML = `
      <div class="q-badge">Q${idx+1} of ${state.questions.length}</div>
      ${locked ? `<div class="lang-lock-notice">🔒 Must answer in <strong>${q.allowed_langs[0].toUpperCase()}</strong> only</div>` : ''}
      <div class="q-title">${Utils.escapeHtml(q.title)}</div>
      <div class="q-desc">${Utils.escapeHtml(String(q.description || ''))}</div>
      <div class="q-marks-badge">⭐ ${q.marks} marks</div>
      ${(q.examples || []).map(ex => `
        <div class="io-example"><div class="io-example-label">SAMPLE INPUT</div><div class="io-example-content">${Utils.escapeHtml(String(ex.input||''))}</div></div>
        <div class="io-example"><div class="io-example-label">EXPECTED OUTPUT</div><div class="io-example-content">${Utils.escapeHtml(String(ex.output||''))}</div></div>`).join('')}`;

    // Lang tabs
    const langTabs = Utils.$('testLangTabs');
    langTabs.innerHTML = ['python','java','cpp'].map(l => {
      const allowed = q.allowed_langs.includes(l);
      const active  = l === lang;
      return `<button class="lang-tab ${active?'active':''}" ${!allowed?'disabled':''} onclick="Test.switchLang('${l}')">${{python:'Python',java:'Java',cpp:'C++'}[l]}</button>`;
    }).join('');

    Utils.setText('testQNum',    idx + 1);
    Utils.setText('testQMarks',  `${q.marks} marks`);
    Utils.setText('currentLangLabel', {python:'Python',java:'Java',cpp:'C++'}[lang]);

    const editor = Utils.$('testCodeEditor');
    editor.value = state.answers[idx]?.code || _defaultCode(lang);
    _updateLineNumbers();

    const out = Utils.$('testOutput');
    if (out) { out.textContent = 'Output appears here...'; out.className = 'io-output'; }
  }

  function _defaultCode(lang) {
    const templates = {
      python: `# Write your Python solution here\nimport sys\ninput = sys.stdin.readline\n\ndef solve():\n    pass\n\nsolve()\n`,
      java:   `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n`,
      cpp:    `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}\n`,
    };
    return templates[lang] || templates.python;
  }

  /* ── LANGUAGE SWITCH ───────────────────────────────────── */
  function switchLang(lang) {
    const q = state.questions[state.currentQ];
    if (!q.allowed_langs.includes(lang)) { Utils.toast(`${lang.toUpperCase()} not allowed for this question.`, 'warning'); return; }
    _saveCurrentAnswer();
    // Store previous lang's code separately
    const prevLang = state.testLang[state.currentQ];
    if (!state.answers[state.currentQ]) state.answers[state.currentQ] = {};
    state.answers[state.currentQ][prevLang] = Utils.$('testCodeEditor')?.value || '';

    state.testLang[state.currentQ] = lang;
    Utils.setText('currentLangLabel', {python:'Python',java:'Java',cpp:'C++'}[lang]);
    document.querySelectorAll('#testLangTabs .lang-tab').forEach(t => {
      const tLang = t.textContent === 'C++' ? 'cpp' : t.textContent.toLowerCase();
      t.classList.toggle('active', tLang === lang);
    });
    const editor = Utils.$('testCodeEditor');
    // Restore that lang's previous code if exists
    editor.value = state.answers[state.currentQ]?.[lang] || _defaultCode(lang);
    _updateLineNumbers();
  }

  /* ── EDITOR ────────────────────────────────────────────── */
  function handleEditorKey(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target, s = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, s) + '    ' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + 4;
      onEditorInput(ta);
    }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runCurrentCode(); }
  }

  function onEditorInput(ta) {
    _updateLineNumbers();
    const status = Utils.$('autoSaveStatus');
    if (status) { status.textContent = '● Unsaved'; status.style.color = 'var(--accent3)'; }
    clearTimeout(onEditorInput._t);
    onEditorInput._t = setTimeout(async () => {
      await _saveCurrentAnswer(true);
      if (status) { status.textContent = '● Saved to Sheets'; status.style.color = 'var(--success)'; }
    }, 2000);
  }

  function _updateLineNumbers() {
    const editor = Utils.$('testCodeEditor');
    const ln     = Utils.$('testLineNums');
    if (!editor || !ln) return;
    ln.textContent = Array.from({ length: editor.value.split('\n').length }, (_, i) => i + 1).join('\n');
    ln.scrollTop   = editor.scrollTop;
  }

  /* ── SAVE ANSWER ───────────────────────────────────────── */
  async function _saveCurrentAnswer(silent = false) {
    const editor = Utils.$('testCodeEditor');
    if (!editor) return;
    const idx  = state.currentQ;
    const lang = state.testLang[idx] || state.questions[idx]?.allowed_langs[0] || 'python';
    const code = editor.value;

    if (!state.answers[idx]) state.answers[idx] = {};
    state.answers[idx] = { lang, code };

    // Save to Google Sheets
    try {
      const q = state.questions[idx];
      await SheetsAPI.saveAnswer(state.sessionId, q.id, q.title, lang, code);
    } catch (err) {
      if (!silent) Utils.toast('Auto-save failed: ' + err.message, 'warning');
    }
  }

  function saveAndLoad(idx) { _saveCurrentAnswer(); loadQuestion(idx); }
  function prevQ() { if (state.currentQ > 0) saveAndLoad(state.currentQ - 1); }
  function nextQ() { if (state.currentQ < state.questions.length - 1) saveAndLoad(state.currentQ + 1); }

  /* ── RUN CODE ──────────────────────────────────────────── */
  async function runCurrentCode() {
    const editor  = Utils.$('testCodeEditor');
    const inputEl = Utils.$('testInput');
    const output  = Utils.$('testOutput');
    const runBtn  = Utils.$('testRunBtn');
    if (!editor || !output) return;

    const lang  = state.testLang[state.currentQ] || 'python';
    const code  = editor.value.trim();
    const stdin = inputEl?.value || '';

    output.className = 'io-output running';
    output.textContent = '⏳ Compiling and executing…';
    if (runBtn) runBtn.disabled = true;

    try {
      const result = await SheetsAPI.executeCode(code, lang, stdin);
      _displayOutput(output, result);
    } catch (err) {
      output.className = 'io-output error';
      output.textContent = '⚠ Error: ' + err.message;
    } finally {
      if (runBtn) runBtn.disabled = false;
    }
  }

  function _displayOutput(el, r) {
    const { stdout, stderr, compile_output, status_id, time, memory, simulated } = r;
    let text = '', cls = 'io-output';
    if (status_id === 3 || simulated) { text = stdout || '(no output)'; }
    else if (status_id === 6)  { text = '🔴 Compilation Error:\n\n' + (compile_output || stderr); cls += ' error'; }
    else                       { text = `🔴 ${r.status}:\n\n` + (stderr || stdout || 'No details'); cls += ' error'; }
    const meta = [];
    if (time)     meta.push(`⏱ ${time}s`);
    if (memory)   meta.push(`💾 ${Math.round(memory/1024)}KB`);
    if (simulated) meta.push('🔵 Simulated');
    if (meta.length) text += '\n\n' + meta.join('  |  ');
    el.className = cls;
    el.textContent = text;
  }

  /* ── TIMER ─────────────────────────────────────────────── */
  function _startTimer() {
    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      const el = Utils.$('testTimer');
      if (el) {
        el.textContent = Utils.formatTime(state.timeLeft);
        if (state.timeLeft <= 300) el.classList.add('urgent');
        if (state.timeLeft === 300) Utils.toast('⚠ 5 minutes remaining!', 'warning', 6000);
        if (state.timeLeft === 60)  Utils.toast('⚠ 1 minute remaining!', 'danger', 6000);
      }
      if (state.timeLeft <= 0) { clearInterval(state.timerInterval); Utils.toast('Time up! Submitting…', 'danger'); setTimeout(() => submit(), 1500); }
    }, 1000);
  }

  /* ── PROCTORING ────────────────────────────────────────── */
  function _setupProctoring() {
    const editor = Utils.$('testCodeEditor');
    if (editor) {
      editor.addEventListener('copy',  e => { e.preventDefault(); _recordViolation('Copy (Ctrl+C) attempted'); });
      editor.addEventListener('cut',   e => { e.preventDefault(); _recordViolation('Cut (Ctrl+X) attempted'); });
      editor.addEventListener('paste', e => { e.preventDefault(); _recordViolation('Paste (Ctrl+V) attempted'); });
    }
    document.addEventListener('contextmenu', e => { if (state.active) e.preventDefault(); });
    document.addEventListener('keydown', e => {
      if (!state.active) return;
      if (e.key === 'F12') { e.preventDefault(); _recordViolation('DevTools (F12) pressed'); }
      if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) { e.preventDefault(); _recordViolation('DevTools shortcut attempted'); }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); _recordViolation('View source (Ctrl+U) attempted'); }
    });
    document.addEventListener('visibilitychange', () => {
      if (state.active && document.hidden) _recordViolation('Tab switch / window hidden');
    });
    window.addEventListener('blur', () => {
      if (state.active) _recordViolation('Window lost focus');
    });
    document.addEventListener('fullscreenchange', () => {
      if (state.active && !Utils.isFullscreen()) {
        _recordViolation('Exited fullscreen');
        Utils.enterFullscreen().catch(() => {});
      }
    });
  }

  async function _recordViolation(reason) {
    state.violations++;
    const bar = Utils.$('violationBar');
    if (bar) {
      bar.textContent = `⚠ VIOLATION #${state.violations}: ${reason} — Saved to Google Sheets`;
      bar.classList.add('show');
      setTimeout(() => bar.classList.remove('show'), 4000);
    }
    try {
      const res = await SheetsAPI.recordViolation(state.sessionId, reason);
      if (res.terminate) { Utils.toast('❌ Max violations reached. Test terminated.', 'danger', 0); setTimeout(() => submit(true), 2000); }
    } catch {}
  }

  function _setupVideoProctoring() {
    navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
      .then(stream => {
        let vid = Utils.$('proctoringVideo');
        if (!vid) {
          vid = document.createElement('video');
          vid.id = 'proctoringVideo';
          vid.style.cssText = 'position:fixed;bottom:10px;right:10px;width:120px;height:90px;border-radius:6px;border:2px solid var(--danger);z-index:9999;opacity:0.85';
          vid.autoplay = true; vid.muted = true;
          document.body.appendChild(vid);
        }
        vid.srcObject = stream;
        Utils.toast('📹 Video proctoring active', 'info', 3000);
      })
      .catch(() => _recordViolation('Camera access denied'));
  }

  /* ── SUBMIT ────────────────────────────────────────────── */
  function confirmSubmit() {
    const answered = Object.keys(state.answers).filter(k => state.answers[k]?.code?.trim()).length;
    Utils.confirm(
      `You have answered ${answered} of ${state.questions.length} questions.\n\nSubmit now? This cannot be undone.`,
      () => submit()
    );
  }

  async function submit(terminated = false) {
    clearInterval(state.timerInterval);
    clearInterval(state.heartbeatInterval);
    clearInterval(state.autoSaveInterval);
    await _saveCurrentAnswer(true);
    state.active = false;
    Utils.clearLocal('activeTest');

    const vid = Utils.$('proctoringVideo');
    if (vid?.srcObject) { vid.srcObject.getTracks().forEach(t => t.stop()); vid.remove(); }
    Utils.exitFullscreen().catch(() => {});

    const timeTakenSec = Math.floor((Date.now() - state.startTime) / 1000);

    // Count primary language
    const langCount = {};
    Object.values(state.testLang).forEach(l => { langCount[l] = (langCount[l] || 0) + 1; });
    const primaryLang = Object.entries(langCount).sort((a,b) => b[1]-a[1])[0]?.[0] || 'python';

    // Build answers map for submission { qId: { lang, code } }
    const answersMap = {};
    state.questions.forEach((q, i) => {
      if (state.answers[i]?.code?.trim()) {
        answersMap[q.id] = { lang: state.testLang[i] || q.allowed_langs[0], code: state.answers[i].code };
      }
    });

    Utils.toast('📊 Submitting to Google Sheets…', 'info', 3000);

    try {
      const result = await SheetsAPI.submitTest({ sessionId: state.sessionId, answers: answersMap, timeTakenSec, primaryLang });
      _showResultPage(result, timeTakenSec, primaryLang);
    } catch (err) {
      // Fallback: show result from local data
      const score = Object.keys(answersMap).length * (state.questions[0]?.marks || 10);
      _showResultPage({ totalScore: score, totalMarks: state.questions.reduce((s,q)=>s+q.marks,0), rank: 'B', violations: state.violations }, timeTakenSec, primaryLang);
      Utils.toast('Submitted (offline mode). Results may not be saved.', 'warning');
    }
  }

  function _showResultPage(result, timeTakenSec, primaryLang) {
    const testPage = Utils.$('testPage');
    if (testPage) testPage.style.display = 'none';
    const resultPage = Utils.$('resultPage');
    if (!resultPage) return;

    const solved = result.gradeDetails?.filter(d => d.score > 0).length ?? Object.keys(state.answers).filter(k => state.answers[k]?.code?.trim()).length;
    const mins = Math.floor(timeTakenSec/60).toString().padStart(2,'0');
    const secs = (timeTakenSec%60).toString().padStart(2,'0');

    Utils.setText('finalScore',       result.totalScore ?? '—');
    Utils.setText('totalMarksDisplay', result.totalMarks ?? 30);
    Utils.setText('resSolved',        `${solved}/${state.questions.length}`);
    Utils.setText('resTimeTaken',     result.timeFmt || `${mins}:${secs}`);
    Utils.setText('resViolations',    result.violations ?? state.violations);
    Utils.setText('resPrimaryLang',   {python:'Python',java:'Java',cpp:'C++'}[primaryLang] || primaryLang);

    const rb = Utils.$('rankBadge');
    if (rb) { rb.textContent = `Rank ${result.rank}`; rb.className = `rank-badge rank-${result.rank}`; }

    resultPage.classList.add('active');
    App.restoreNav();
  }

  function backToHome() {
    const testPage = Utils.$('testPage');
    if (testPage) { testPage.classList.remove('active'); testPage.style.display = 'none'; }
    App.showPage('landing');
  }

  return { start, resume, loadQuestion, saveAndLoad, switchLang, prevQ, nextQ, handleEditorKey, onEditorInput, runCurrentCode, confirmSubmit, submit, backToHome, get state() { return state; } };
})();
