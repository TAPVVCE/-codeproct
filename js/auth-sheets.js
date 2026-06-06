/* ============================================================
   CODEPROCT — auth.js  (Google Sheets edition)
   Google OAuth + student details → saves to Sheets
   ============================================================ */

const Auth = (() => {

  /* ── GOOGLE OAUTH ──────────────────────────────────────── */
  function handleGoogleResponse(response) {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      _onGoogleSuccess({ email: payload.email, name: payload.name, sub: payload.sub });
    } catch {
      Utils.toast('Google login failed. Please try again.', 'danger');
    }
  }

  function demoGoogleLogin() {
    _onGoogleSuccess({ email: 'student.demo@gmail.com', name: 'Demo Student', sub: 'demo_' + Date.now() });
  }

  function _onGoogleSuccess(profile) {
    App.state.googleProfile = profile;
    const el = Utils.$('authEmail');
    if (el) el.textContent = profile.email;
    const el2 = Utils.$('authEmailSmall');
    if (el2) el2.textContent = profile.email;
    Utils.toast('Google account verified ✓', 'success');
    App.showPage('studentDetails');
  }

  /* ── STUDENT DETAILS SUBMIT ────────────────────────────── */
  async function beginTest() {
    const name  = (Utils.$('stName')  || {}).value?.trim();
    const usn   = (Utils.$('stUSN')   || {}).value?.trim();
    const phone = (Utils.$('stPhone') || {}).value?.trim();
    const email = (Utils.$('stEmail') || {}).value?.trim();

    if (!name || !usn || !phone || !email) {
      Utils.toast('Please fill in all required fields.', 'warning'); return;
    }
    if (!email.includes('@')) {
      Utils.toast('Enter a valid college email address.', 'warning'); return;
    }

    const btn = Utils.$('beginTestBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Registering…'; }

    try {
      // Get IP
      const ip = App.state.detectedIP || '—';
      const profile = App.state.googleProfile || {};

      // Register in Google Sheets
      const regData = await SheetsAPI.registerStudent({
        name, usn, phone,
        college_email: email,
        google_email:  profile.email || '',
        google_sub:    profile.sub   || '',
        ip_address:    ip,
      });

      App.state.student = { name, usn, phone, email, ip, googleEmail: profile.email, studentId: regData.studentId };

      // Start session in Sheets
      const session = await SheetsAPI.startSession();
      App.state.sessionId = session.sessionId;
      App.state.durationSecs = session.durationSecs || 2700;

      Utils.saveLocal('activeTest', { active: true, student: App.state.student, sessionId: session.sessionId });
      Test.start();
    } catch (err) {
      Utils.toast('Registration failed: ' + err.message, 'danger');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Begin Proctored Assessment →'; }
    }
  }

  return { handleGoogleResponse, demoGoogleLogin, beginTest };
})();

/* ── ADMIN AUTH (Google Sheets) ─────────────────────────── */
const AdminAuth = (() => {
  let loginModal = null;

  function showLoginModal() {
    if (loginModal) loginModal.remove();
    loginModal = document.createElement('div');
    loginModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:800;display:flex;align-items:center;justify-content:center';
    loginModal.innerHTML = `
      <div style="background:#111827;border:1px solid #4a5568;border-radius:12px;padding:36px;width:400px;max-width:95vw;font-family:inherit">
        <div style="font-family:monospace;font-size:13px;font-weight:700;color:#00d4aa;margin-bottom:4px;letter-spacing:1px">CODE<span style="color:#9ca3af">PROCT</span></div>
        <div style="font-size:10px;color:#4a5568;margin-bottom:18px;font-family:monospace">Connected to Google Sheets ✓</div>
        <h2 style="font-size:18px;font-weight:700;color:#fff;margin-bottom:6px">Admin Portal Login</h2>
        <p style="font-size:12px;color:#9ca3af;margin-bottom:22px">Credentials verified against Google Sheets (Admins tab).</p>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.8px;display:block;margin-bottom:5px">ADMIN EMAIL</label>
          <input id="adminEmailInput" type="email" placeholder="admin@institution.edu"
            style="width:100%;background:#1f2937;border:1px solid #4a5568;color:#e2e8f0;border-radius:6px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#00d4aa'" onblur="this.style.borderColor='#4a5568'">
        </div>
        <div style="margin-bottom:20px">
          <label style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.8px;display:block;margin-bottom:5px">PASSWORD</label>
          <input id="adminPassInput" type="password" placeholder="••••••••"
            style="width:100%;background:#1f2937;border:1px solid #4a5568;color:#e2e8f0;border-radius:6px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#00d4aa'" onblur="this.style.borderColor='#4a5568'"
            onkeydown="if(event.key==='Enter')AdminAuth.doLogin()">
        </div>
        <div id="adminLoginError" style="display:none;color:#f87171;font-size:12px;margin-bottom:12px;padding:8px 10px;background:rgba(239,68,68,0.08);border-radius:6px;border:1px solid rgba(239,68,68,0.2)"></div>
        <div style="display:flex;gap:8px">
          <button id="adminLoginBtn" onclick="AdminAuth.doLogin()"
            style="flex:1;padding:10px;background:#00d4aa;color:#0a0e1a;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            Login to Admin Panel
          </button>
          <button onclick="AdminAuth.closeModal()"
            style="padding:10px 16px;background:transparent;border:1px solid #4a5568;color:#9ca3af;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit">
            Cancel
          </button>
        </div>
        <p style="font-size:11px;color:#374151;text-align:center;margin-top:12px">Demo: admin@test.com / admin123</p>
      </div>`;
    document.body.appendChild(loginModal);
    setTimeout(() => Utils.$('adminEmailInput')?.focus(), 100);
  }

  async function doLogin() {
    const email = (Utils.$('adminEmailInput') || {}).value?.trim();
    const pass  = (Utils.$('adminPassInput')  || {}).value?.trim();
    const errEl = Utils.$('adminLoginError');
    const btn   = Utils.$('adminLoginBtn');

    if (!email || !pass) {
      if (errEl) { errEl.textContent = 'Please enter email and password.'; errEl.style.display = 'block'; }
      return;
    }

    if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }
    if (errEl) errEl.style.display = 'none';

    try {
      const data = await SheetsAPI.adminLogin(email, pass);
      App.state.admin = { email, name: data.name, role: data.role };
      closeModal();
      _openAdminPortal();
    } catch (err) {
      if (errEl) { errEl.textContent = err.message || 'Invalid credentials.'; errEl.style.display = 'block'; }
    } finally {
      if (btn) { btn.textContent = 'Login to Admin Panel'; btn.disabled = false; }
    }
  }

  function closeModal() {
    if (loginModal) { loginModal.remove(); loginModal = null; }
    App.showPage('landing');
  }

  function _openAdminPortal() {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    Utils.show('adminPortal');
    App.setNavAdmin();
    AdminPortal.init();
    Utils.toast(`Welcome, ${App.state.admin.name}!`, 'success');
  }

  function logout() {
    App.state.admin = null;
    SheetsAPI.adminLogout();
    Utils.hide('adminPortal');
    App.setNavDefault();
    App.showPage('landing');
    Utils.toast('Logged out.', 'info');
  }

  return { showLoginModal, doLogin, closeModal, logout };
})();
