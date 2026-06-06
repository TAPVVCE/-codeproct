/* ============================================================
   CODEPROCT — playground.js  (Google Sheets edition)
   Visitor code playground using SheetsAPI.executeCode()
   ============================================================ */

const Playground = (() => {
  let currentLang = 'python';
  const savedCode = {
    python: `# Write your Python solution here\nimport sys\ninput = sys.stdin.readline\n\nn = int(input())\nfor i in range(1, n + 1):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)\n`,
    java:   `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        for (int i = 1; i <= n; i++) {\n            if (i % 15 == 0)      System.out.println("FizzBuzz");\n            else if (i % 3 == 0)  System.out.println("Fizz");\n            else if (i % 5 == 0)  System.out.println("Buzz");\n            else                   System.out.println(i);\n        }\n    }\n}\n`,
    cpp:    `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    for (int i = 1; i <= n; i++) {\n        if (i % 15 == 0)      cout << "FizzBuzz\\n";\n        else if (i % 3 == 0)  cout << "Fizz\\n";\n        else if (i % 5 == 0)  cout << "Buzz\\n";\n        else                   cout << i << "\\n";\n    }\n    return 0;\n}\n`,
  };

  function init() {
    const editor = Utils.$('playCode');
    if (!editor) return;
    editor.value = savedCode.python;
    updateLines();
    editor.addEventListener('scroll', () => {
      const ln = Utils.$('playLineNums');
      if (ln) ln.scrollTop = editor.scrollTop;
    });
  }

  function switchLang(lang, btn) {
    const editor = Utils.$('playCode');
    if (editor) savedCode[currentLang] = editor.value;
    currentLang = lang;
    document.querySelectorAll('#playLangTabs .lang-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (editor) { editor.value = savedCode[lang] || ''; updateLines(); }
    const out = Utils.$('playOutput');
    if (out) { out.textContent = 'Click RUN to execute your code.'; out.className = 'io-output'; }
  }

  function onCodeInput(textarea) {
    savedCode[currentLang] = textarea.value;
    updateLines();
  }

  function handleTab(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target, s = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, s) + '    ' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + 4;
      onCodeInput(ta);
    }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); run(); }
  }

  function updateLines() {
    const editor = Utils.$('playCode');
    const ln = Utils.$('playLineNums');
    if (!editor || !ln) return;
    ln.textContent = Array.from({ length: editor.value.split('\n').length }, (_, i) => i + 1).join('\n');
  }

  async function run() {
    const editor = Utils.$('playCode');
    const inputEl = Utils.$('playInput');
    const output = Utils.$('playOutput');
    const runBtn = document.querySelector('.run-btn');
    if (!editor || !output) return;

    const code  = editor.value.trim();
    const stdin = inputEl ? inputEl.value : '';
    if (!code) { output.textContent = 'No code to run.'; return; }

    output.className = 'io-output running';
    output.textContent = 'Compiling and executing...';
    if (runBtn) runBtn.disabled = true;

    try {
      const result = await SheetsAPI.executeCode(code, currentLang, stdin);
      _displayOutput(output, result);
    } catch (err) {
      output.className = 'io-output error';
      output.textContent = 'Error: ' + err.message;
    } finally {
      if (runBtn) runBtn.disabled = false;
    }
  }

  function _displayOutput(el, r) {
    const { stdout, stderr, compile_output, status_id, time, memory, simulated } = r;
    let text = '', cls = 'io-output';
    if (!status_id || status_id === 3) { text = stdout || '(no output)'; }
    else if (status_id === 6) { text = 'Compilation Error:\n\n' + (compile_output || stderr); cls += ' error'; }
    else { text = (r.status || 'Runtime Error') + ':\n\n' + (stderr || stdout || 'No details'); cls += ' error'; }
    const meta = [];
    if (time)     meta.push(time + 's');
    if (memory)   meta.push(Math.round(memory/1024) + 'KB');
    if (simulated) meta.push('Simulated — add JUDGE0_KEY for real execution');
    if (meta.length) text += '\n\n' + meta.join('  |  ');
    el.className = cls;
    el.textContent = text;
  }

  return { init, switchLang, onCodeInput, handleTab, run, get currentLang() { return currentLang; } };
})();

window.addEventListener('DOMContentLoaded', () => Playground.init());
