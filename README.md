# Inter IIT Hockey Attendance

    frontend/   the web pages (index.html, style.css, app.js, config.js)
    backend/    the server code (server.js) + seed.json (team list from the register)
    api/        tiny file that lets Vercel run the backend
    vercel.json, package.json, .env.example

## 1. Firebase (database only)
1. Firebase console > Project settings > Service accounts > **Generate new private key**. A .json file downloads. Keep it secret.
2. Firestore Database > **Rules**, replace everything with the lines below and Publish.
   The website no longer talks to Firestore directly, only the backend does, so lock it:

       rules_version = '2';
       service cloud.firestore {
         match /databases/{db}/documents { match /{doc=**} { allow read, write: if false; } }
       }

## 2. Deploy on Vercel (one project, both parts)
1. Put this whole folder in a GitHub repo (vercel.json must be at the top level of the repo).
2. vercel.com > Add New > Project > import the repo. Leave Framework as "Other". Do not change build settings.
3. Before pressing Deploy, open **Environment Variables** and add:
   - CAPTAIN_CODE  (the captain's login code)
   - VICE_CODE     (the vice-captain's login code)
   - TOKEN_SECRET  (any long random text)
   - FIREBASE_SERVICE_ACCOUNT  (open the downloaded .json, copy everything, paste as the value)
4. Deploy. Open your Vercel link, log in, go to **Players** and press **Import team**.
5. If you change an environment variable later, press **Redeploy**.

Test the backend alone: open `https://YOUR-SITE.vercel.app/api/health` - you should see {"ok":true}.
If it shows "Backend not configured", a variable above is missing or the JSON was pasted wrongly.

## How it works for everyone
- **Login first.** Nothing is shown or sent without a login. The first screen is the login page, then the Home page.
  Players: roll number + their own code. Captain / Vice-captain / Admin: **Captain / Admin** tab.
- **Install as an app:** *Install app* on the login page or in the ⋮ menu (Chrome/Edge/Android). On iPhone: Safari > Share > Add to Home Screen. The icons are in `frontend/icons/`.
- **⋮ menu** lists every tab plus tools: Add students, WhatsApp template (admins), Alerts on/off, calendar file, Install, Hockey WhatsApp group, Log out. Each option appears once.
- **Admins** (Admins tab, captain/vice only): add with a name and code. Admins log in with *Admin* + their name + code. A switch turns an admin's access on or off at once, *Remove* deletes them.
- **Removed students** (admin tab): *Remove* in Players only hides a student (they are logged out, attendance history is kept). *Restore* brings them back with the same login code. *Delete forever* erases them.
- Captain and vice-captain codes are set in Vercel (CAPTAIN_CODE, VICE_CODE). Press **Import team** (Players tab) once after the first deploy.

Firestore layout (you can open and edit these in the Firebase console):

    players/<roll number>    name, roll, position, joined (YYYY-MM-DD), n (list order), contact, removed
    sessions/<YYYY-MM-DD>    r: { <roll number>: true or false }
    legacy/<YYYY-MM>         days, att: { <roll number>: days attended }
    plans/<YYYY-MM-DD>       time, note, status
    rules/<id>, warmup/<id>  title, icon, order, items [ {h, b, img, yt} ]
    config/schedule          team and gk (7 rows each)
    admins/<id>              name, disabled, salt, hash   (codes are never stored in plain text)
    accounts/<roll>          salt, hash of the player's own code
    signupTries/<roll>       wrong contact-number attempts (locks at 10)
    config/template          WhatsApp message template

## Player sign up / login
- **No login:** a player picks their roll number in *My progress*; it is remembered on that device only.
- **With login** (header **Log in**): the captain/admin adds the player first (⋮ > **Add students**, or Players tab) with name, roll no and contact number.
  The player opens Log in, types the roll number, confirms the contact number the captain saved, and chooses a unique code (4 to 30 characters). Next time: roll number + code, any device (30 days).
  No SMS/OTP provider is needed. 10 wrong contact numbers lock that roll number; the captain presses **Reset code** in the Players tab to unlock it or when a player forgets the code.
- A player login can only read that player's own data, never take attendance or edit anything.
- Contact numbers, e-mails and jersey details are visible only to the captain, vice-captain and admins (and to the player for their own record).
- ⋮ > **Add students**: one student, paste many lines as `Name, Roll no, Contact`, or **Import jersey form list** (backend/jersey.json).

## WhatsApp, template, alerts
- **WhatsApp buttons** open WhatsApp with the message ready; pick the hockey group and press send (WhatsApp has no free way to post to a group automatically).
  Attendance: after saving, or the *Send on WhatsApp* button. Playing day: *WhatsApp* on each row of Playing days. Weekly schedule: Schedule tab.
- **Message template** (captain/admin, ⋮ menu or Schedule tab): editable text with {day} {date} {time} {session} {note}. Shared by all admins.
- **Hockey WhatsApp group** link is in `frontend/config.js` (WA_GROUP), shown in the ⋮ menu and Schedule tab.
- **Alerts on/off** (⋮ menu, for everyone): a notification 15 minutes before each fixed playing day that has a time. It works while the app is open or in a background tab. Browsers cannot wake a closed page without a paid push service. On iPhone, notifications only work after Share > Add to Home Screen and opening from the home screen.
- **Add schedule to calendar** (⋮ menu): downloads an .ics file of upcoming fixed days with a built-in 15-minute reminder. This is the reliable option, it works with the app closed.
- New Firestore data: `accounts/<roll>`, `signupTries/<roll>`, `config/template`. Players gain optional fields contact, email, size, jerseyName, jerseyNo.

## Run on your own computer
    npm install
    copy .env.example to .env and fill it in
    npm run dev        # open http://localhost:3000

## Privacy
Without a login the server returns nothing. A logged-in player receives only their own record and attendance plus the shared info (playing days, schedule, rules, warm-up).
The codes live only in the server's environment variables, not in the web page.
