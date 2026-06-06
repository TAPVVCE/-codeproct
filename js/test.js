/* ============================================================
   CODEPROCT — TEST.JS
   Full proctored test engine: fullscreen, anti-cheat,
   timer, code editor, submission, grading
   ============================================================ */

const Test = (() => {

  /* ── STATE ───────────────────────────────────────────── */
  const state = {
    currentQ:      0,
    answers:       {},   // { qIdx: { lang: code } }
    testLang:      {},   // { qIdx: selectedLang }
    violations:    0,
    timerInterval: null,
    timeLeft:      0,
    startTime:     null,
    active:        false,
    results:       [],
  };

  /* ── START ───────────────────────────────────────────── */
  function start() {
    state.timeLeft  = CONFIG.TEST.duration_minutes * 60;
    state.startTime = Date.now();
    state.violations = 0;
    state.answers   = {};
    state.testLang  = {};
    state.active    = true;
    state.currentQ  = 0;

    // Set default language per question
    QUESTIONS.forEach((q, i) => {
      state.testLang[i] = q.allowed_langs[0];
    });

    _buildTestPage();
    _showTestPage();

    _startTimer();
    _setupProctoring();
    _setupVideoProctoring();

    // Request fullscreen
    if (CONFIG.TEST.fullscreen_required) {
      Utils.enterFullscreen().catch(() =>
        _recordViolation('Fullscreen request denied')
      );
    }

    loadQuestion(0);
  }

  function resume(savedState) {
    // TODO: restore from savedState for page-reload recovery
    start();
  }

  /* ── BUILD TEST PAGE DOM ──────────────────────────────── */
  function _buildTestPage() {
    // Create test page if not already in DOM
    let page = Utils.$('testPage');
    if (!page) {
      page = document.createElement('div');
      page.id = 'testPage';
      document.body.appendChild(page);
    }

    const student = App.state.student;

    page.innerHTML = `
      <!-- Violation bar -->
      <div class="violation-bar" id="violationBar">
        ⚠ VIOLATION DETECTED — This has been recorded and reported.
      </div>

      <!-- Test Header -->
      <div class="test-header">
        <div class="test-meta">
          <div class="test-logo">CODE<span>PROCT</span></div>
          <div class="test-qinfo">
            Proctored Assessment &nbsp;|&nbsp;
            Q<strong id="testQNum">1</strong>/${QUESTIONS.length} &nbsp;|&nbsp;
            <strong id="testQMarks">10 marks</strong>
          </div>
          <span class="proc-badge" id="recBadge">🔴 REC</span>
          <span class="proc-badge">📍 IP: ${Utils.escapeHtml(student?.ip || '—')}</span>
        </div>

        <div class="test-timer" id="testTimer">
          ${Utils.formatTime(state.timeLeft)}
        </div>

        <div class="test-actions">
          <span class="student-name-display" id="testStudentName">
            ${Utils.escapeHtml(student?.name || 'Student')}
          </span>
          <button class="btn btn-success btn-sm" onclick="Test.runCurrentCode()">▶ Run</button>
          <button class="btn btn-danger btn-sm" onclick="Test.confirmSubmit()">Submit All</button>
        </div>
      </div>

      <!-- Test Body -->
      <div class="test-body">

        <!-- Question Panel -->
        <div class="question-panel">
          <div class="q-nav-bar" id="qNavBar"></div>
          <div class="q-content" id="qContent"></div>
        </div>

        <!-- Code Panel -->
        <div class="code-panel">
          <div class="test-code-header">
            <div class="test-lang-tabs" id="testLangTabs"></div>
            <div class="test-code-meta">
              <span id="currentLangLabel">Python</span>
              <span id="autoSaveStatus" style="color:var(--success);font-size:11px">● Auto-saved</span>
            </div>
          </div>

          <div class="test-editor-wrap">
            <div class="line-numbers" id="testLineNums">1</div>
            <textarea
              id="testCodeEditor"
              class="test-code-editor"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              onkeydown="Test.handleEditorKey(event)"
              oninput="Test.onEditorInput(this)"
            ></textarea>
          </div>

          <div class="test-io">
            <div class="io-pane">
              <div class="io-label">CUSTOM INPUT (optional)</div>
              <textarea id="testInput" class="io-editor" placeholder="Enter custom test input..."></textarea>
            </div>
            <div class="io-pane">
              <div class="io-label">
                OUTPUT
                <button class="run-btn" id="testRunBtn" onclick="Test.runCurrentCode()">▶ RUN</button>
              </div>
              <div id="testOutput" class="io-output">Output appears here after running...</div>
            </div>
          </div>

          <div class="test-footer">
            <div class="test-footer-hint">
              Ctrl+Enter to run &nbsp;|&nbsp; Tab for indent &nbsp;|&nbsp; Changes auto-saved every 5s
            </div>
            <div class="test-footer-actions">
              <button class="btn btn-ghost btn-sm" onclick="Test.prevQ()">← Prev</button>
              <button class="btn btn-blue btn-sm"  onclick="Test.nextQ()">Next →</button>
            </div>
          </div>
        </div>

      </div>

      <!-- Result Page (shown after submit) -->
      <div id="resultPage">
        <div class="result-card">
          <div class="result-eyebrow">ASSESSMENT COMPLETE</div>
          <div class="result-score" id="finalScore">—</div>
          <div class="result-out-of">
            out of <strong id="totalMarksDisplay">30</strong> marks
            &nbsp;|&nbsp;
            <span class="rank-badge" id="rankBadge">—</span>
          </div>
          <div class="result-grid">
            <div class="result-stat">
              <div class="result-stat-val" id="resSolved">—</div>
              <div class="result-stat-label">Questions Solved</div>
            </div>
            <div class="result-stat">
              <div class="result-stat-val" id="resTimeTaken">—</div>
              <div class="result-stat-label">Time Taken</div>
            </div>
            <div class="result-stat">
              <div class="result-stat-val" id="resViolations">0</div>
              <div class="result-stat-label">Violations Recorded</div>
            </div>
            <div class="result-stat">
              <div class="result-stat-val" id="resPrimaryLang">—</div>
              <div class="result-stat-label">Primary Language</div>
            </div>
          </div>
          <div class="result-info-bar">
            ✓ Answers saved &nbsp;|&nbsp;
            ✓ IP & session logged &nbsp;|&nbsp;
            ✓ Proctoring report generated &nbsp;|&nbsp;
            ✓ Results exported to Excel
          </div>
          <button class="btn btn-primary btn-block" onclick="Test.backToHome()">
            Return to Home
          </button>
        </div>
      </div>
    `;
  }

  /* ── SHOW / HIDE TEST PAGE ────────────────────────────── */
  function _showTestPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    Utils.hide('adminPortal');
    App.setNavTest();

    const page = Utils.$('testPage');
    page.classList.add('active');
    page.style.display = 'flex';
  }

  /* ── LOAD QUESTION ────────────────────────────────────── */
  function loadQuestion(idx) {
    _saveCurrentAnswer();
    state.currentQ = idx;
    const q = QUESTIONS[idx];
    const lang = state.testLang[idx] || q.allowed_langs[0];

    // ── Q Nav ──
    const navBar = Utils.$('qNavBar');
    if (navBar) {
      navBar.innerHTML = QUESTIONS.map((qq, i) => {
        const answered = !!(state.answers[i] && Object.values(state.answers[i]).some(c => c && c.trim() !== STARTER_CODE[state.testLang[i] || qq.allowed_langs[0]].default.trim()));
        const cls = [
          'q-nav-btn',
          i === idx    ? 'current'  : '',
          answered     ? 'answered' : '',
        ].filter(Boolean).join(' ');
        return `<button class="${cls}" onclick="Test.saveAndLoad(${i})">${i + 1}</button>`;
      }).join('');
    }

    // ── Q Content ──
    const qContent = Utils.$('qContent');
    const locked = q.allowed_langs.length === 1;
    qContent.innerHTML = `
      <div class="q-badge">Q${idx + 1} of ${QUESTIONS.length}</div>
      ${locked ? `<div class="lang-lock-notice">🔒 This question requires <strong>${q.allowed_langs[0].toUpperCase()}</strong> only</div>` : ''}
      <div class="q-title">${Utils.escapeHtml(q.title)}</div>
      <div class="q-desc">${Utils.escapeHtml(q.description)}</div>
      <div class="q-marks-badge">⭐ ${q.marks} marks</div>
      ${q.examples.map(ex => `
        <div class="io-example">
          <div class="io-example-label">SAMPLE INPUT</div>
          <div class="io-example-content">${Utils.escapeHtml(ex.input)}</div>
        </div>
        <div class="io-example">
          <div class="io-example-label">EXPECTED OUTPUT</div>
          <div class="io-example-content">${Utils.escapeHtml(ex.output)}</div>
        </div>
      `).join('')}
    `;

    // ── Lang Tabs ──
    const langTabs = Utils.$('testLangTabs');
    langTabs.innerHTML = ['python', 'java', 'cpp'].map(l => {
      const allowed = q.allowed_langs.includes(l);
      const active  = l === lang;
      const label   = { python: 'Python', java: 'Java', cpp: 'C++' }[l];
      return `
        <button
          class="lang-tab ${active ? 'active' : ''}"
          ${!allowed ? 'disabled title="Not allowed for this question"' : ''}
          onclick="Test.switchLang('${l}')"
        >${label}</button>`;
    }).join('');

    // ── Header meta ──
    Utils.setText('testQNum', idx + 1);
    Utils.setText('testQMarks', `${q.marks} marks`);
    Utils.setText('currentLangLabel', { python: 'Python', java: 'Java', cpp: 'C++' }[lang]);

    // ── Load code ──
    const editor = Utils.$('testCodeEditor');
    editor.value = state.answers[idx]?.[lang] || STARTER_CODE[lang].default;
    _updateTestLineNumbers();

    // ── Clear output ──
    const out = Utils.$('testOutput');
    if (out) { out.textContent = 'Output appears here after running...'; out.className = 'io-output'; }
  }

  /* ── LANGUAGE SWITCH ──────────────────────────────────── */
  function switchLang(lang) {
    const q = QUESTIONS[state.currentQ];
    if (!q.allowed_langs.includes(lang)) {
      Utils.toast(`${lang.toUpperCase()} is not allowed for this question.`, 'warning');
      return;
    }
    _saveCurrentAnswer();
    state.testLang[state.currentQ] = lang;
    Utils.setText('currentLangLabel', { python: 'Python', java: 'Java', cpp: 'C++' }[lang]);

    // Update tab highlights
    document.querySelectorAll('#testLangTabs .lang-tab').forEach(t => {
      t.classList.toggle('active', t.textContent.toLowerCase() === lang ||
        (lang === 'cpp' && t.textContent === 'C++'));
    });

    const editor = Utils.$('testCodeEditor');
    editor.value = state.answers[state.currentQ]?.[lang] || STARTER_CODE[lang].default;
    _updateTestLineNumbers();
  }

  /* ── EDITOR EVENTS ────────────────────────────────────── */
  function handleEditorKey(e) {
    // Tab → 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, s) + '    ' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + 4;
      onEditorInput(ta);
    }
    // Ctrl+Enter → run
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runCurrentCode(); }
  }

  function onEditorInput(ta) {
    _updateTestLineNumbers();
    // Debounced auto-save indicator
    const status = Utils.$('autoSaveStatus');
    if (status) { status.textContent = '● Saving...'; status.style.color = 'var(--accent3)'; }
    clearTimeout(onEditorInput._t);
    onEditorInput._t = setTimeout(() => {
      _saveCurrentAnswer();
      if (status) { status.textContent = '● Auto-saved'; status.style.color = 'var(--success)'; }
    }, 1000);
  }

  function _updateTestLineNumbers() {
    const editor = Utils.$('testCodeEditor');
    const ln = Utils.$('testLineNums');
    if (!editor || !ln) return;
    const count = editor.value.split('\n').length;
    ln.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    ln.scrollTop = editor.scrollTop;
  }

  /* ── SAVE ANSWER ──────────────────────────────────────── */
  function _saveCurrentAnswer() {
    const editor = Utils.$('testCodeEditor');
    if (!editor) return;
    const idx  = state.currentQ;
    const lang = state.testLang[idx] || QUESTIONS[idx].allowed_langs[0];
    if (!state.answers[idx]) state.answers[idx] = {};
    state.answers[idx][lang] = editor.value;

    // Persist to localStorage (anti-reload loss)
    Utils.saveLocal('answers', state.answers);
  }

  function saveAndLoad(idx) {
    _saveCurrentAnswer();
    loadQuestion(idx);
  }

  function prevQ() { if (state.currentQ > 0) saveAndLoad(state.currentQ - 1); }
  function nextQ() { if (state.currentQ < QUESTIONS.length - 1) saveAndLoad(state.currentQ + 1); }

  /* ── CODE EXECUTION ───────────────────────────────────── */
  async function runCurrentCode() {
    const editor  = Utils.$('testCodeEditor');
    const inputEl = Utils.$('testInput');
    const output  = Utils.$('testOutput');
    const runBtn  = Utils.$('testRunBtn');
    if (!editor || !output) return;

    const lang   = state.testLang[state.currentQ] || QUESTIONS[state.currentQ].allowed_langs[0];
    const code   = editor.value.trim();
    const stdin  = inputEl?.value || '';

    output.className = 'io-output running';
    output.textContent = '⏳ Compiling and executing…';
    if (runBtn) runBtn.disabled = true;

    try {
      const result = await Playground.executeCode(code, lang, stdin);
      Playground.displayOutput(output, result);
    } catch (err) {
      output.className = 'io-output error';
      output.textContent = '⚠ Error: ' + err.message;
    } finally {
      if (runBtn) runBtn.disabled = false;
    }
  }

  /* ── TIMER ────────────────────────────────────────────── */
  function _startTimer() {
    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      const el = Utils.$('testTimer');
      if (el) {
        el.textContent = Utils.formatTime(state.timeLeft);
        if (state.timeLeft <= 300) el.classList.add('urgent');
        if (state.timeLeft === 300) Utils.toast('⚠ 5 minutes remaining!', 'warning', 6000);
        if (state.timeLeft === 60)  Utils.toast('⚠ 1 minute remaining!', 'danger',  6000);
      }
      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        Utils.toast('Time is up! Submitting automatically...', 'danger', 4000);
        setTimeout(() => submit(), 1500);
      }
    }, 1000);
  }

  /* ── PROCTORING ───────────────────────────────────────── */
  function _setupProctoring() {
    if (!CONFIG.TEST.copy_paste_blocked) return;

    const editor = Utils.$('testCodeEditor');
    if (!editor) return;

    // Block copy / cut / paste in editor
    editor.addEventListener('copy',  e => { e.preventDefault(); _recordViolation('Copy (Ctrl+C) attempted'); });
    editor.addEventListener('cut',   e => { e.preventDefault(); _recordViolation('Cut (Ctrl+X) attempted'); });
    editor.addEventListener('paste', e => { e.preventDefault(); _recordViolation('Paste (Ctrl+V) attempted'); });

    // Block right-click
    document.addEventListener('contextmenu', e => { if (state.active) e.preventDefault(); });

    // Block devtools shortcuts
    document.addEventListener('keydown', e => {
      if (!state.active) return;
      if (e.key === 'F12') { e.preventDefault(); _recordViolation('F12 (DevTools) key pressed'); }
      if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) {
        e.preventDefault(); _recordViolation('DevTools shortcut attempted');
      }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); _recordViolation('View source attempted'); }
    });

    // Tab switch / window blur
    if (CONFIG.TEST.tab_switch_detection) {
      document.addEventListener('visibilitychange', () => {
        if (state.active && document.hidden) _recordViolation('Tab switch / window minimized');
      });
      window.addEventListener('blur', () => {
        if (state.active) _recordViolation('Window lost focus');
      });
    }

    // Fullscreen exit
    document.addEventListener('fullscreenchange', () => {
      if (state.active && !Utils.isFullscreen()) {
        _recordViolation('Exited fullscreen mode');
        Utils.enterFullscreen().catch(() => {});
      }
    });
  }

  function _recordViolation(reason) {
    state.violations++;
    const bar = Utils.$('violationBar');
    if (bar) {
      bar.textContent = `⚠ VIOLATION #${state.violations}: ${reason} — Recorded & reported to admin`;
      bar.classList.add('show');
      setTimeout(() => bar.classList.remove('show'), 4000);
    }
    console.warn('[CodeProct] Violation:', reason, 'Total:', state.violations);

    // Auto-terminate if too many violations
    if (state.violations >= CONFIG.TEST.max_violations_before_terminate) {
      Utils.toast('❌ Maximum violations reached. Test terminated.', 'danger', 0);
      setTimeout(() => submit(true), 2000);
    }
  }

  /* ── VIDEO PROCTORING ─────────────────────────────────── */
  function _setupVideoProctoring() {
    if (!CONFIG.TEST.video_proctoring) return;

    navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
      .then(stream => {
        // Create hidden video element for proctoring
        let vid = Utils.$('proctoringVideo');
        if (!vid) {
          vid = document.createElement('video');
          vid.id = 'proctoringVideo';
          vid.style.cssText = 'position:fixed;bottom:10px;right:10px;width:120px;height:90px;border-radius:6px;border:2px solid var(--danger);z-index:9999;opacity:0.85';
          vid.autoplay = true;
          vid.muted = true;
          document.body.appendChild(vid);
        }
        vid.srcObject = stream;
        Utils.toast('📹 Video proctoring active', 'info', 3000);
        const badge = Utils.$('recBadge');
        if (badge) badge.style.animation = 'pulse 2s infinite';
      })
      .catch(() => {
        _recordViolation('Camera access denied (required for video proctoring)');
      });
  }

  /* ── CONFIRM SUBMIT ───────────────────────────────────── */
  function confirmSubmit() {
    const answered = Object.keys(state.answers).length;
    const total    = QUESTIONS.length;
    Utils.confirm(
      `You have answered ${answered} of ${total} questions.\n\nAre you sure you want to submit? This action cannot be undone.`,
      () => submit()
    );
  }

  /* ── SUBMIT & GRADE ───────────────────────────────────── */
  async function submit(terminated = false) {
    clearInterval(state.timerInterval);
    _saveCurrentAnswer();
    state.active = false;
    Utils.clearLocal('activeTest');

    // Stop video stream
    const vid = Utils.$('proctoringVideo');
    if (vid?.srcObject) {
      vid.srcObject.getTracks().forEach(t => t.stop());
      vid.remove();
    }

    // Exit fullscreen
    Utils.exitFullscreen().catch(() => {});

    // ── Grade ──
    const timeTakenSec = Math.floor((Date.now() - state.startTime) / 1000);
    let totalScore = 0;
    let solved = 0;

    const gradeResults = QUESTIONS.map((q, i) => {
      const lang    = state.testLang[i] || q.allowed_langs[0];
      const code    = state.answers[i]?.[lang] || '';
      const isEmpty = !code.trim() || code.trim() === (STARTER_CODE[lang]?.default || '').trim();
      const score   = isEmpty ? 0 : q.marks;   // Simplified: full marks if non-empty (use Judge0 for real)
      if (score > 0) solved++;
      totalScore += score;
      return { qId: q.id, title: q.title, lang, score, maxScore: q.marks, submitted: !isEmpty };
    });

    // Primary language (most used)
    const langCount = {};
    Object.values(state.testLang).forEach(l => { langCount[l] = (langCount[l] || 0) + 1; });
    const primaryLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'python';

    const totalMarks = QUESTIONS.reduce((s, q) => s + q.marks, 0);
    const rank = Utils.calculateRank(totalScore, totalMarks);

    // ── Save results ──
    const finalResult = {
      student:       App.state.student,
      score:         totalScore,
      totalMarks,
      rank,
      solved,
      timeTakenSec,
      violations:    state.violations,
      primaryLang,
      terminated,
      submittedAt:   new Date().toISOString(),
      gradeDetails:  gradeResults,
    };

    // In production: POST finalResult to your backend / Firebase
    console.info('[CodeProct] Final result:', finalResult);
    Utils.saveLocal('lastResult', finalResult);

    // ── Show result UI ──
    _showResultPage(finalResult);
  }

  function _showResultPage(result) {
    const testPage = Utils.$('testPage');
    if (testPage) testPage.style.display = 'none';

    const resultPage = Utils.$('resultPage');
    if (!resultPage) return;

    Utils.setText('finalScore',       result.score);
    Utils.setText('totalMarksDisplay', result.totalMarks);
    Utils.setText('resSolved',        `${result.solved}/${QUESTIONS.length}`);
    Utils.setText('resTimeTaken',     Utils.formatDuration(result.timeTakenSec));
    Utils.setText('resViolations',    result.violations);
    Utils.setText('resPrimaryLang',   { python: 'Python', java: 'Java', cpp: 'C++' }[result.primaryLang] || result.primaryLang);

    const rankEl = Utils.$('rankBadge');
    if (rankEl) {
      rankEl.textContent = `Rank ${result.rank}`;
      rankEl.className = `rank-badge rank-${result.rank}`;
    }

    resultPage.classList.add('active');
    App.restoreNav();
  }

  function backToHome() {
    const testPage = Utils.$('testPage');
    if (testPage) { testPage.classList.remove('active'); testPage.style.display = 'none'; }
    App.showPage('landing');
  }

  return {
    start,
    resume,
    loadQuestion,
    saveAndLoad,
    switchLang,
    prevQ,
    nextQ,
    handleEditorKey,
    onEditorInput,
    runCurrentCode,
    confirmSubmit,
    submit,
    backToHome,
    get state() { return state; },
  };
})();
