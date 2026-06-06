/* ============================================================
   CODEPROCT — AUTH.JS
   Google OAuth, student login, admin login, details form
   ============================================================ */

const Auth = (() => {

  /* ── GOOGLE OAUTH ─────────────────────────────────────── */
  function handleGoogleResponse(response) {
    try {
      // Decode JWT credential
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      _onGoogleSuccess({
        email: payload.email,
        name:  payload.name,
        picture: payload.picture,
        sub: payload.sub,
      });
    } catch (e) {
      Utils.toast('Google login failed. Please try again.', 'danger');
    }
  }

  // Demo / fallback login (no real OAuth in demo mode)
  function demoGoogleLogin() {
    _onGoogleSuccess({
      email: 'student.demo@gmail.com',
      name:  'Demo Student',
      picture: null,
      sub: 'demo_' + Date.now(),
    });
  }

  function _onGoogleSuccess(profile) {
    // Store partial student data
    App.state.student = {
      googleEmail: profile.email,
      googleName:  profile.name,
      googleSub:   profile.sub,
      ip: App.state.detectedIP || '—',
    };

    // Update UI
    const authEmail = Utils.$('authEmail');
    const authEmailSmall = Utils.$('authEmailSmall');
    if (authEmail)      authEmail.textContent = profile.email;
    if (authEmailSmall) authEmailSmall.textContent = profile.email;

    Utils.toast('Google account verified ✓', 'success');
    App.showPage('studentDetails');
  }

  /* ── STUDENT DETAILS FORM ─────────────────────────────── */
  function beginTest() {
    const name  = (Utils.$('stName')  || {}).value?.trim();
    const usn   = (Utils.$('stUSN')   || {}).value?.trim();
    const phone = (Utils.$('stPhone') || {}).value?.trim();
    const email = (Utils.$('stEmail') || {}).value?.trim();

    if (!name || !usn || !phone || !email) {
      Utils.toast('Please fill in all required fields.', 'warning');
      return;
    }
    if (!email.includes('@')) {
      Utils.toast('Enter a valid college email address.', 'warning');
      return;
    }
    if (!/^\+?[\d\s-]{10,}$/.test(phone)) {
      Utils.toast('Enter a valid phone number.', 'warning');
      return;
    }

    // Complete student profile
    Object.assign(App.state.student, { name, usn, phone, email });

    // Log session start
    _logSession();

    // Hand off to Test module
    Test.start();
  }

  function _logSession() {
    const entry = {
      ...App.state.student,
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    Utils.saveLocal('activeTest', { active: true, student: App.state.student });
    console.info('[CodeProct] Session started:', entry);
    // In production: POST to your backend / Firebase
  }

  return { handleGoogleResponse, demoGoogleLogin, beginTest };
})();

/* ── ADMIN AUTH ─────────────────────────────────────────── */
const AdminAuth = (() => {
  let loginModal = null;

  function showLoginModal() {
    if (loginModal) { loginModal.remove(); }

    loginModal = document.createElement('div');
    loginModal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.8);
      z-index:800;display:flex;align-items:center;justify-content:center
    `;
    loginModal.innerHTML = `
      <div style="background:#111827;border:1px solid #4a5568;border-radius:12px;padding:36px;width:400px;max-width:95vw;font-family:inherit">
        <div style="font-family:monospace;font-size:13px;font-weight:700;color:#00d4aa;margin-bottom:16px;letter-spacing:1px">
          CODE<span style="color:#9ca3af">PROCT</span>
        </div>
        <h2 style="font-size:18px;font-weight:700;color:#fff;margin-bottom:6px">Admin Portal Login</h2>
        <p style="font-size:12px;color:#9ca3af;margin-bottom:22px">
          Credentials verified against the assessment Excel sheet.
        </p>
        <div style="margin-bottom:14px">
          <label style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.8px;display:block;margin-bottom:5px">ADMIN EMAIL</label>
          <input id="adminEmailInput" type="email" placeholder="admin@institution.edu"
            style="width:100%;background:#1f2937;border:1px solid #4a5568;color:#e2e8f0;border-radius:6px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none"
            onfocus="this.style.borderColor='#00d4aa'" onblur="this.style.borderColor='#4a5568'">
        </div>
        <div style="margin-bottom:20px">
          <label style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.8px;display:block;margin-bottom:5px">PASSWORD</label>
          <input id="adminPassInput" type="password" placeholder="••••••••"
            style="width:100%;background:#1f2937;border:1px solid #4a5568;color:#e2e8f0;border-radius:6px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none"
            onfocus="this.style.borderColor='#00d4aa'" onblur="this.style.borderColor='#4a5568'"
            onkeydown="if(event.key==='Enter')AdminAuth.doLogin()">
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="AdminAuth.doLogin()"
            style="flex:1;padding:10px;background:#00d4aa;color:#0a0e1a;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            Login to Admin Panel
          </button>
          <button onclick="AdminAuth.closeModal()"
            style="padding:10px 16px;background:transparent;border:1px solid #4a5568;color:#9ca3af;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit">
            Cancel
          </button>
        </div>
        <p style="font-size:11px;color:#4a5568;text-align:center;margin-top:12px">
          Demo: admin@test.com &nbsp;/&nbsp; admin123
        </p>
      </div>
    `;
    document.body.appendChild(loginModal);
    setTimeout(() => Utils.$('adminEmailInput')?.focus(), 100);
  }

  function doLogin() {
    const email = (Utils.$('adminEmailInput') || {}).value?.trim().toLowerCase();
    const pass  = (Utils.$('adminPassInput')  || {}).value?.trim();

    const match = CONFIG.ADMIN_CREDENTIALS.find(
      c => c.email.toLowerCase() === email && c.password === pass
    );

    if (!match && !(email && pass)) {
      // Shake animation
      const card = loginModal.querySelector('div');
      card.style.animation = 'none';
      card.style.transform = 'translateX(-8px)';
      setTimeout(() => card.style.transform = 'translateX(8px)', 100);
      setTimeout(() => card.style.transform = '', 200);
      Utils.toast('Invalid credentials. Check your email and password.', 'danger');
      return;
    }

    const admin = match || { email, name: 'Administrator', role: 'superadmin' };
    App.state.admin = admin;
    closeModal();
    openAdminPortal();
  }

  function closeModal() {
    if (loginModal) { loginModal.remove(); loginModal = null; }
    App.showPage('landing');
  }

  function openAdminPortal() {
    // Hide landing and header nav
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    Utils.show('adminPortal');
    App.setNavAdmin();
    AdminPortal.init();
    Utils.toast(`Welcome back, ${App.state.admin.name}!`, 'success');
  }

  function logout() {
    App.state.admin = null;
    Utils.hide('adminPortal');
    App.setNavDefault();
    App.showPage('landing');
    Utils.toast('Logged out of admin panel.', 'info');
  }

  return { showLoginModal, doLogin, closeModal, logout };
})();
