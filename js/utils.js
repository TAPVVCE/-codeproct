/* ============================================================
   CODEPROCT — UTILS.JS
   Shared utility functions
   ============================================================ */

const Utils = (() => {

  /* ── DOM HELPERS ─────────────────────────────────────── */
  function $(id)   { return document.getElementById(id); }
  function $q(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden');    }
  function toggle(id) { $(id).classList.toggle('hidden'); }

  function setHTML(id, html) { $(id).innerHTML = html; }
  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }

  /* ── TOAST NOTIFICATIONS ─────────────────────────────── */
  function toast(message, type = 'info', duration = 3500) {
    let container = $('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.4s';
      setTimeout(() => el.remove(), 400);
    }, duration);
  }

  /* ── IP DETECTION ────────────────────────────────────── */
  async function getPublicIP() {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const d = await r.json();
      return d.ip;
    } catch {
      // Fallback: simulate an IP
      return '103.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255);
    }
  }

  /* ── DEVICE DETECTION ────────────────────────────────── */
  function isMobileOrTablet() {
    const ua = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua)
      || (navigator.maxTouchPoints > 1 && /mac/.test(ua) && window.innerWidth < 1200);
  }

  function getDeviceType() {
    if (/mobile/i.test(navigator.userAgent)) return 'Mobile ❌';
    if (/tablet|ipad/i.test(navigator.userAgent)) return 'Tablet ❌';
    return 'Desktop ✓';
  }

  /* ── TIMER HELPERS ───────────────────────────────────── */
  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  }

  /* ── STORAGE HELPERS ─────────────────────────────────── */
  function saveLocal(key, value) {
    try { localStorage.setItem('cp_' + key, JSON.stringify(value)); } catch {}
  }
  function loadLocal(key, fallback = null) {
    try {
      const v = localStorage.getItem('cp_' + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function clearLocal(key) {
    try { localStorage.removeItem('cp_' + key); } catch {}
  }

  /* ── STRING HELPERS ──────────────────────────────────── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, max = 60) {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  /* ── LINE NUMBER SYNC ────────────────────────────────── */
  function syncLineNumbers(editorId, lineNumId) {
    const editor = $(editorId);
    const lineNums = $(lineNumId);
    if (!editor || !lineNums) return;

    const lines = editor.value.split('\n').length;
    const nums = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    lineNums.textContent = nums;

    // Sync scroll
    editor.addEventListener('scroll', () => {
      lineNums.scrollTop = editor.scrollTop;
    });
  }

  function updateLineNumbers(textarea, lineNumEl) {
    const lines = textarea.value.split('\n').length;
    const current = parseInt(lineNumEl.textContent.split('\n').pop()) || 0;
    if (current !== lines) {
      lineNumEl.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }
    lineNumEl.scrollTop = textarea.scrollTop;
  }

  /* ── RANK CALCULATION ────────────────────────────────── */
  function calculateRank(score, total) {
    const pct = (score / total) * 100;
    if (pct >= 90) return 'S';
    if (pct >= 70) return 'A';
    if (pct >= 50) return 'B';
    return 'C';
  }

  /* ── EXCEL EXPORT (client-side CSV) ──────────────────── */
  function exportCSV(rows, filename = 'results.csv') {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const v = row[h] ?? '';
          return typeof v === 'string' && (v.includes(',') || v.includes('"'))
            ? `"${v.replace(/"/g, '""')}"`
            : v;
        }).join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── FULLSCREEN ──────────────────────────────────────── */
  function enterFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    return Promise.resolve();
  }

  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.resolve();
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /* ── CONFIRM DIALOG ──────────────────────────────────── */
  function confirm(message, onYes, onNo) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#1f2937;border:1px solid #4a5568;border-radius:10px;padding:28px;max-width:360px;width:90%;font-family:inherit">
        <div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:10px">Confirm Action</div>
        <div style="font-size:13px;color:#9ca3af;line-height:1.6;margin-bottom:20px">${escapeHtml(message)}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="confirmNo"  style="padding:8px 18px;border-radius:6px;border:1px solid #4a5568;background:transparent;color:#9ca3af;cursor:pointer;font-family:inherit;font-size:13px">Cancel</button>
          <button id="confirmYes" style="padding:8px 18px;border-radius:6px;border:none;background:#ef4444;color:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirmYes').addEventListener('click', () => { overlay.remove(); onYes && onYes(); });
    overlay.querySelector('#confirmNo').addEventListener('click',  () => { overlay.remove(); onNo  && onNo();  });
  }

  /* ── DEBOUNCE ────────────────────────────────────────── */
  function debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return {
    $, $q, $all,
    show, hide, toggle,
    setHTML, setText,
    toast,
    getPublicIP,
    isMobileOrTablet,
    getDeviceType,
    formatTime,
    formatDuration,
    saveLocal,
    loadLocal,
    clearLocal,
    escapeHtml,
    truncate,
    syncLineNumbers,
    updateLineNumbers,
    calculateRank,
    exportCSV,
    enterFullscreen,
    exitFullscreen,
    isFullscreen,
    confirm,
    debounce,
  };
})();
