# CodeProct — Proctored Online Coding Assessment Platform

A full-featured, enterprise-grade proctored coding assessment platform for institutions,
supporting **Java, Python, and C++**, scalable to **1 lakh (100,000)+ concurrent students**.

---

## 📁 Project Structure

```
codeproct/
├── index.html              ← Landing page + Visitor Playground + Student Login
├── admin/
│   └── index.html          ← Admin portal (direct access)
├── pages/
│   └── test.html           ← Proctored test page
├── css/
│   ├── main.css            ← Core styles, layout, buttons, forms
│   ├── playground.css      ← Code editor, test page, result card
│   └── admin.css           ← Admin sidebar, tables, toggles, charts
└── js/
    ├── config.js           ← API keys, questions, mock data, settings
    ├── utils.js            ← DOM helpers, toast, IP, export, fullscreen
    ├── app.js              ← Page router, global state, mobile guard
    ├── playground.js       ← Visitor code playground + Judge0 execution
    ├── auth.js             ← Google OAuth, student details, admin login
    ├── test.js             ← Full proctored test engine + anti-cheat
    └── admin.js            ← Admin portal: dashboard, students, results, settings
```

---

## 🚀 Quick Start (Demo Mode)

1. Open `index.html` in any modern browser (Chrome/Edge recommended)
2. **Visitor Playground** — right half of the screen, no login needed
3. **Student Flow** — click "Take Assessment" → Google login → fill details → test
4. **Admin Portal** — click "Admin Portal" → use `admin@test.com` / `admin123`

> No server or build tools needed for the demo. All code runs in the browser.

---

## ⚙️ Production Setup

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Add your domain to Authorized Origins
5. Copy the Client ID into `js/config.js`:

```js
GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com'
```

6. In `index.html`, update the `data-client_id` attribute:

```html
<div id="g_id_onload" data-client_id="your-client-id.apps.googleusercontent.com" ...>
```

---

### 2. Judge0 API (Live Code Execution)

Sign up for free at [RapidAPI — Judge0](https://rapidapi.com/judge0-official/api/judge0-ce)

Update `js/config.js`:

```js
JUDGE0_URL: 'https://judge0-ce.p.rapidapi.com',
JUDGE0_KEY: 'your-rapidapi-key-here',
```

For **self-hosted Judge0** (recommended for 1 lakh students):

```bash
# Using Docker
git clone https://github.com/judge0/judge0.git
cd judge0
cp judge0.conf.example judge0.conf
# Edit judge0.conf with your settings
docker-compose up -d
```

Then set:
```js
JUDGE0_URL: 'https://your-judge0-server.com',
JUDGE0_KEY: '',   // leave empty for self-hosted
```

---

### 3. Backend / Database (for 1 lakh students)

For production scale, replace the mock data with a real backend:

#### Option A — Firebase (recommended, free tier)

```bash
npm install firebase
```

```js
// Add to config.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ...
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
```

Replace `Utils.saveLocal()` calls in `test.js` with Firestore writes.

#### Option B — Node.js + PostgreSQL

```bash
npm install express pg cors xlsx
```

Endpoints needed:
- `POST /api/session/start`       — log student session start
- `POST /api/answers/save`        — auto-save code answers
- `POST /api/submission/final`    — submit and grade
- `GET  /api/admin/students`      — list all students
- `GET  /api/admin/results`       — get all results
- `POST /api/admin/questions`     — upload questions from Excel

---

### 4. Excel Integration

#### Upload via Admin Portal

The admin portal's Upload section accepts `.xlsx` files.
Install `xlsx` npm package for proper parsing:

```bash
npm install xlsx
```

```js
import * as XLSX from 'xlsx';

function parseExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: 'binary' });
    const questions = XLSX.utils.sheet_to_json(wb.Sheets['Questions']);
    const config    = XLSX.utils.sheet_to_json(wb.Sheets['Config'])[0];
    const admins    = XLSX.utils.sheet_to_json(wb.Sheets['Admins']);
    // Load into App.state
    App.state.questions = questions;
  };
  reader.readAsBinaryString(file);
}
```

#### Export Results to Excel

```js
import * as XLSX from 'xlsx';

function exportResultsToExcel(results) {
  const ws = XLSX.utils.json_to_sheet(results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, 'codeproct_results.xlsx');
}
```

---

### 5. Video Proctoring (Production)

For real AI proctoring (gaze detection, face presence), integrate:

- **Proctorio** — https://proctorio.com
- **Mettl** — https://mettl.com
- **AWS Rekognition** — custom face detection

Minimal webcam recording (already built-in):

```js
// test.js already captures webcam stream
// To record and upload:
const mediaRecorder = new MediaRecorder(stream);
const chunks = [];
mediaRecorder.ondataavailable = e => chunks.push(e.data);
mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  const formData = new FormData();
  formData.append('video', blob, `${studentUSN}_session.webm`);
  await fetch('/api/proctoring/upload', { method: 'POST', body: formData });
};
mediaRecorder.start(10000); // save chunk every 10s
```

---

### 6. Deployment

#### Simple (Static Hosting)

Works on **GitHub Pages**, **Netlify**, **Vercel** out of the box.

```bash
# Netlify
netlify deploy --dir .

# Vercel
vercel --prod
```

#### Enterprise Scale (1 lakh students)

```
Load Balancer (Nginx / AWS ALB)
    ├── Multiple App Servers (Node.js / Python FastAPI)
    ├── Judge0 Cluster (self-hosted, 10-20 workers)
    ├── PostgreSQL (primary + read replicas)
    ├── Redis (session cache, real-time student status)
    └── S3 / GCS (video recordings, Excel exports)
```

Estimated infra for 1 lakh concurrent:
- 5-10 × 4-core app servers
- 20-40 × Judge0 workers (1 per 5 concurrent executions)
- PostgreSQL RDS (db.r6g.2xlarge)
- Redis ElastiCache
- CDN (CloudFront) for static assets

---

## 🔒 Anti-Cheat Features

| Feature | Implementation |
|---|---|
| Full-screen enforcement | `requestFullscreen()` + fullscreenchange listener |
| Tab switch detection | `visibilitychange` + `window.blur` events |
| Copy/paste blocking | `copy`, `cut`, `paste` event preventDefault |
| Right-click disabled | `contextmenu` event preventDefault |
| DevTools blocked | F12, Ctrl+Shift+I/J/C keys blocked |
| View source blocked | Ctrl+U blocked |
| Mobile/tablet blocked | User-agent + touch point detection |
| IP tracking | Auto-detected via ipify.org API |
| Google auth required | OAuth 2.0 before test access |
| Video proctoring | WebRTC getUserMedia() + optional recording |
| Violation counting | Auto-terminate after N violations |

---

## 📊 Marks Calculation

Current mode: **Answer presence** (non-empty, non-template code = full marks)

For production: connect to **Judge0** and compare `stdout` against `expected_output`:

```js
function gradeAnswer(stdout, testCases) {
  let passed = 0;
  testCases.forEach(tc => {
    const clean = s => s.trim().replace(/\r\n/g, '\n');
    if (clean(stdout) === clean(tc.expected_output)) passed++;
  });
  return Math.round((passed / testCases.length) * 100);
}
```

---

## 🔑 Admin Credentials (Demo)

| Email | Password | Role |
|---|---|---|
| admin@test.com | admin123 | superadmin |
| proctor@college.edu | proctor1 | proctor |

In production: store as bcrypt hashes in your database / Sheet 1 of the Excel file.

---

## 📞 Support & Customisation

To add more features:
- **More languages** (Go, Rust, JS) — add language IDs from [Judge0 Languages API](https://judge0-ce.p.rapidapi.com/languages)
- **MCQ questions** — extend the `QUESTIONS` array with `type: 'mcq'`
- **Webcam snapshots** — use `canvas.drawImage(video, ...)` to snapshot every 60s
- **Plagiarism detection** — compare student code with MOSS API
- **Real-time leaderboard** — WebSocket + Redis pub/sub
