/* ============================================================
   CODEPROCT — app.js  (Google Sheets edition)
   Page router and global state
   ============================================================ */

const App = (() => {

  const state = {
    currentPage:   'landing',
    student:       null,
    admin:         null,
    googleProfile: null,
    sessionId:     null,
    durationSecs:  2700,
    detectedIP:    null,
    questions:     [],
    _answerUSN:    '',
    _addQModal:    null,
  };

  async function init() {
    if (_isMobileOrTablet()) { Utils.show('mobileBlock'); return; }

    const ip = await Utils.getPublicIP();
    state.detectedIP = ip;
    ['detectedIP','detailsIP'].forEach(id => { const el = Utils.$(id); if (el) el.textContent = ip; });
    const devEl = Utils.$('deviceCheck');
    if (devEl) devEl.textContent = Utils.getDeviceType();

    showPage('landing');
  }

  function _isMobileOrTablet() {
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && /mac/.test(navigator.userAgent.toLowerCase()) && window.innerWidth < 1200);
  }

  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
    if (name === 'adminLogin') { AdminAuth.showLoginModal(); return; }
    const pageMap = { landing:'landingPage', studentLogin:'studentLoginPage', studentDetails:'studentDetailsPage' };
    const pageId = pageMap[name];
    if (pageId) { Utils.show(pageId); Utils.$(pageId).classList.add('active'); }
    state.currentPage = name;
  }

  function setNavAdmin() {
    Utils.$('mainNav').innerHTML = `
      <span style="font-size:11px;color:var(--text2)">Admin: ${Utils.escapeHtml(state.admin?.name||'')}</span>
      <button class="btn btn-danger btn-sm" onclick="AdminAuth.logout()">Exit Admin</button>`;
  }

  function setNavDefault() {
    Utils.$('mainNav').innerHTML = `
      <button class="btn btn-ghost" onclick="App.showPage('adminLogin')">Admin Portal</button>
      <button class="btn btn-primary" onclick="App.showPage('studentLogin')">Take Assessment</button>`;
  }

  function setNavTest() { const h = Utils.$('mainHeader'); if (h) h.style.display = 'none'; }
  function restoreNav() { const h = Utils.$('mainHeader'); if (h) h.style.display = ''; setNavDefault(); }

  return { init, showPage, state, setNavAdmin, setNavDefault, setNavTest, restoreNav };
})();

window.addEventListener('DOMContentLoaded', () => App.init());
