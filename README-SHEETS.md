# CodeProct — Google Sheets Setup Guide

This guide walks you through connecting CodeProct to Google Sheets
so all student data, answers, scores, and violations are saved
automatically — for free, with unlimited storage.

---

## What gets saved to Google Sheets?

| Sheet Tab        | Data Stored                                                      |
|------------------|------------------------------------------------------------------|
| **Config**       | Test duration, proctoring toggles, institution name             |
| **Admins**       | Admin email, password (hashed), role                            |
| **Questions**    | Question text, marks, allowed languages, test cases             |
| **Students**     | Name, USN, phone, email, Google email, IP, device, timestamp    |
| **Sessions**     | Session ID, start/end time, live status, violations, time left  |
| **Answers**      | Every student's code for every question, language, score        |
| **Results**      | Final score, rank, grade, time taken, violations, language      |
| **Violations_Log** | Every anti-cheat event with reason and timestamp              |
| **Activity_Log** | Full audit trail of all platform events                         |

---

## STEP 1 — Open Google Apps Script

1. Go to **script.google.com**
2. Click **New Project**
3. Name it: `CodeProct Backend`
4. Delete all existing code in the editor

---

## STEP 2 — Paste the backend code

1. Open the file **`sheets-setup/Code.gs`** from this project
2. Copy **all** of its contents
3. Paste into the Apps Script editor
4. Click **Save** (Ctrl+S)

---

## STEP 3 — Run the setup function

1. In the Apps Script editor, find the function dropdown (top toolbar)
2. Select **`setupSheets`** from the dropdown
3. Click the **Run** button (▶)
4. A permissions dialog will appear — click **Review permissions**
5. Choose your Google account
6. Click **Advanced** → **Go to CodeProct Backend (unsafe)**
7. Click **Allow**

This will:
- Create a new Google Spreadsheet called "CodeProct — Assessment Platform"
- Create all 9 sheet tabs with proper headers
- Add default admin credentials (`admin@test.com` / `admin123`)
- Add 3 sample questions
- Apply formatting and freeze header rows

8. Check the **Execution log** (bottom panel) for the Sheet URL — copy it.

---

## STEP 4 — Deploy as Web App

1. Click **Deploy** (top right) → **New deployment**
2. Click the gear icon next to "Type" → select **Web app**
3. Fill in these settings exactly:

```
Description:     CodeProct API v1
Execute as:      Me (your Google account)
Who has access:  Anyone
```

4. Click **Deploy**
5. Copy the **Web App URL** — it looks like:
   `https://script.google.com/macros/s/AKfy.../exec`

---

## STEP 5 — Paste the Web App URL into the platform

Open the file **`js/sheets-api.js`** and find this line near the top:

```js
WEB_APP_URL: 'YOUR_WEB_APP_URL_HERE',
```

Replace it with your actual URL:

```js
WEB_APP_URL: 'https://script.google.com/macros/s/AKfy.../exec',
```

Save the file.

---

## STEP 6 — Add Google OAuth Client ID

1. Go to **console.cloud.google.com**
2. Create a project (or select existing)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized JavaScript origins: `https://YOURUSERNAME.github.io`
7. Click **Create** and copy the Client ID

Now update two files:

**`index.html`** — find and replace:
```html
data-client_id="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
```

**`js/sheets-api.js`** — find and replace:
```js
GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
```

---

## STEP 7 — Push to GitHub and test

```bash
git add .
git commit -m "Connect Google Sheets backend"
git push origin main
```

Wait ~60 seconds for GitHub Pages to deploy, then visit your site.

**Test the flow:**
1. Open your GitHub Pages URL
2. Click **Admin Portal** → login with `admin@test.com` / `admin123`
3. Check the Dashboard — it should show live data from Sheets
4. Click **Open Google Sheets** to see the spreadsheet

---

## STEP 8 — Customize admin credentials

Open your Google Sheet → go to the **Admins** tab → edit:
- Change `admin@test.com` to your real admin email
- Generate a new password hash by running `_hashPassword('YourPassword')` in Apps Script

Or add a row:
```
email               | password_hash (SHA-256) | name        | role
hod@college.edu     | (run _hashPassword())   | Prof. Rajan | superadmin
```

---

## STEP 9 — Upload your questions

**Option A — Edit directly in Google Sheets:**
Open your Sheet → go to the **Questions** tab → edit rows 2 onwards.

Column format:
```
id | title | description | marks | time_limit_secs | allowed_langs | test_cases_json | examples_json | created_at
```

For `allowed_langs`: use comma-separated values like `python,java,cpp` or just `python`

For `test_cases_json`:
```json
[{"input":"5","expected":"1\n2\nFizz\n4\nBuzz","hidden":false}]
```

**Option B — Use the Admin Portal:**
Login → Questions → Add Question → fills the Sheet automatically.

---

## STEP 10 — Share the link with students

Send your GitHub Pages URL to students:
```
https://YOURUSERNAME.github.io/codeproct/
```

When they open it:
1. Landing page with code playground appears
2. They click **Take Assessment**
3. They sign in with Google (real OAuth)
4. They fill in Name, USN, Phone, College Email
5. Their details are immediately saved to the **Students** sheet
6. They enter the proctored test (fullscreen)
7. Their code is auto-saved to the **Answers** sheet every 30 seconds
8. Every violation is logged to the **Violations_Log** sheet in real time
9. On submit, results appear in the **Results** sheet instantly
10. Student sees their score and rank immediately

---

## Monitoring during the test (Admin)

1. Open Admin Portal → **Students** tab
2. Click **Refresh** to see live status of all students
3. See who is active, submitted, or flagged
4. Click **Answers** to view any student's actual code
5. Click **Open Google Sheets** for the full raw data

Or open your Google Sheet directly and watch rows appear in real time.

---

## Updating the deployment (re-deploy after code changes)

Every time you change `Code.gs`:
1. Click **Deploy → Manage deployments**
2. Click the pencil (edit) icon on your existing deployment
3. Change Version to **New version**
4. Click **Deploy**

The Web App URL stays the same — no need to update `sheets-api.js`.

---

## Troubleshooting

**"Web App URL not configured"** — You haven't pasted the URL into `sheets-api.js` yet.

**"Sheets API error: 403"** — Redeploy the Web App and make sure "Who has access" is set to **Anyone**.

**"Invalid token"** — The Apps Script token expired (3 hour limit). Student needs to re-login.

**Questions not loading** — Check the Questions sheet has data starting from row 2. Make sure `allowed_langs` column has comma-separated values with no spaces around commas.

**Admin login fails** — The password in the Admins sheet is a SHA-256 hash. Run `Logger.log(_hashPassword('yourpassword'))` in Apps Script to get the correct hash.

**CORS error** — Make sure the Web App is deployed with "Who has access: Anyone" and your `fetch` call uses `Content-Type: text/plain` (already handled in `sheets-api.js`).

---

## Data limits

Google Sheets limits per spreadsheet:
- 10 million cells total
- Each row uses ~10 columns = 1 million rows possible
- At 1 lakh (100,000) students with 3 answers each = 300,000 answer rows = well within limits

Google Apps Script limits (free):
- 6 minutes execution time per call (more than enough)
- 20,000 requests per day (upgrade to Workspace for more)
- For 1 lakh students: use batch saving or a Redis queue in front of Apps Script

---

## Security notes

- Passwords in the Admins sheet are SHA-256 hashed — never stored as plain text
- Student tokens expire after 3 hours
- The Web App URL is public but all write operations require a valid token
- IP addresses are logged for every student session
- For extra security, move admin credentials to Google Secret Manager
