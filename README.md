# Inter IIT Hockey Attendance

    frontend/   the web pages (index.html, style.css, app.js, config.js)
    backend/    the server code (server.js) + seed.json (team list from the register)
    api/        tiny file that lets Vercel run the backend
    vercel.json, package.json, .env.example

## 1. Firebase (database only)

1.  Firebase console > Project settings > Service accounts > **Generate new private key**. A .json file downloads. Keep it secret.
2.  Firestore Database > **Rules**, replace everything with the lines below and Publish.
    The website no longer talks to Firestore directly, only the backend does, so lock it:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{db}/documents { match /{doc=**} { allow read, write: if false; } }
        }

## 2. Deploy on Vercel (one project, both parts)

1. Put this whole folder in a GitHub repo (vercel.json must be at the top level of the repo).
2. vercel.com > Add New > Project > import the repo. Leave Framework as "Other". Do not change build settings.
3. Before pressing Deploy, open **Environment Variables** and add:
   - CAPTAIN_CODE (the captain's login code)
   - VICE_CODE (the vice-captain's login code)
   - TOKEN_SECRET (any long random text)
   - FIREBASE_SERVICE_ACCOUNT (open the downloaded .json, copy everything, paste as the value)
4. Deploy. Open your Vercel link, log in, go to **Players** and press **Import team**.
5. If you change an environment variable later, press **Redeploy**.

Test the backend alone: open `https://YOUR-SITE.vercel.app/api/health` - you should see {"ok":true}.
If it shows "Backend not configured", a variable above is missing or the JSON was pasted wrongly.

## How it works for everyone

- **Public page (no login):** shows app features, captain, vice-captain, coach, team photos, fixtures and news. Players' names, contact details and attendance are never sent without a login. **Log in** opens the login page (✕ goes back). The captain sets the names under ⋮ > _Edit captain & coach names_.
- **Open in app / Continue in web** is asked once per browser session. A website cannot force-launch an installed app, so _Open in app_ installs it (or explains how).
- **Attendance %** = days present ÷ total working days. The total is the same for every player; a missed day counts as absent.
- **Smartwatch:** Training tab > _Scan QR code on the watch_, then _Connect this watch_ (Bluetooth). Live heart rate needs a watch that shares standard Bluetooth heart rate.
- **Login for the app itself:** after login, Home shows personal details and feature shortcuts.
  Players: roll number + their own code. Captain / Vice-captain / Admin: **Captain / Admin** tab.
- **Install as an app:** _Install app_ on the login page or in the ⋮ menu (Chrome/Edge/Android). On iPhone: Safari > Share > Add to Home Screen. The icons are in `frontend/icons/`.
- **⋮ menu** lists every tab plus tools: Add students, WhatsApp template (admins), Alerts on/off, calendar file, Install, Hockey WhatsApp group, Log out. Each option appears once.
- **Admins** (Admins tab, captain/vice only): add with a name and code. Admins log in with _Admin_ + their name + code. A switch turns an admin's access on or off at once, _Remove_ deletes them.
- **Removed students** (admin tab): _Remove_ in Players only hides a student (they are logged out, attendance history is kept). _Restore_ brings them back with the same login code. _Delete forever_ erases them.
- Captain and vice-captain codes are set in Vercel (CAPTAIN_CODE, VICE_CODE). Press **Import team** (Players tab) once after the first deploy.

Firestore layout (you can open and edit these in the Firebase console):

    players/<roll number>    name, roll, position, joined (YYYY-MM-DD), n (list order), contact, removed
    sessions/<YYYY-MM-DD>    r: { <roll number>: true or false }
    legacy/<YYYY-MM>         days, att: { <roll number>: days attended }   (monthly totals, Jul 2026 onward only)
    plans/<YYYY-MM-DD>       time, note, status
    rules/<id>, warmup/<id>  title, icon, order, items [ {h, b, img, yt} ]
    config/schedule          team and gk (7 rows each)
    admins/<id>              name, disabled, salt, hash   (codes are never stored in plain text)
    accounts/<roll>          salt, hash of the player's own code
    signupTries/<roll>       wrong contact-number attempts (locks at 10)
    config/template          WhatsApp message template

## Player sign up / login

- **No login:** a player picks their roll number in _My progress_; it is remembered on that device only.
- **With login** (header **Log in**): the captain/admin adds the player first (⋮ > **Add students**, or Players tab) with name, roll no and contact number.
  The player opens Log in, types the roll number, confirms the contact number the captain saved, and chooses a unique code (4 to 30 characters). Next time: roll number + code, any device (30 days).
  No SMS/OTP provider is needed. 10 wrong contact numbers lock that roll number; the captain presses **Reset code** in the Players tab to unlock it or when a player forgets the code.
- A player login can only read that player's own data, never take attendance or edit anything.
- Contact numbers, e-mails and jersey details are visible only to the captain, vice-captain and admins (and to the player for their own record).
- ⋮ > **Add students**: one student, paste many lines as `Name, Roll no, Contact`, or **Import jersey form list** (backend/jersey.json).

## WhatsApp, template, alerts

- **WhatsApp buttons** open WhatsApp with the message ready; pick the hockey group and press send (WhatsApp has no free way to post to a group automatically).
  Attendance: after saving, or the _Send on WhatsApp_ button. Playing day: _WhatsApp_ on each row of Playing days. Weekly schedule: Schedule tab.
- **Message template** (captain/admin, ⋮ menu or Schedule tab): editable text with {day} {date} {time} {venue} {session} {note}. Shared by all admins.
- **Hockey WhatsApp group** link: any admin can change it in the app (⋮ > Edit group link). It is saved in `config/group`; `frontend/config.js` (WA_GROUP) is only the fallback.
- **Alerts on/off** (⋮ menu, for everyone): a notification 15 minutes before each fixed playing day that has a time. It works while the app is open or in a background tab. This one only fires while the app is open; for closed-app notifications use **Push** below. On iPhone, notifications only work after Share > Add to Home Screen and opening from the home screen.
- **Add schedule to calendar** (⋮ menu): downloads an .ics file of upcoming fixed days with a built-in 15-minute reminder. This is the reliable option, it works with the app closed.
- New Firestore data: `accounts/<roll>`, `signupTries/<roll>`, `config/template`. Players gain optional fields contact, email, size, jerseyName, jerseyNo.

## Run on your own computer

    npm install
    copy .env.example to .env and fill it in
    npm run dev        # open http://localhost:3000

## Privacy

Without a login the server returns nothing. A logged-in player receives only their own record and attendance plus the shared info (playing days, schedule, rules, warm-up).
The codes live only in the server's environment variables, not in the web page.

## Day-wise attendance (10 Nov 2025 to 13 Oct 2026)

Taken from the WhatsApp group screenshots and stored in `backend/seed.json` under `sessions` (75 days). On a fresh install _Import team_ loads it. On an existing site open **Players** and press **Replace with day-wise attendance** (or **Re-apply register data** once it is loaded). It overwrites the attendance saved for those dates, deletes the old monthly totals that are now day-wise (Nov 2025, Jan to Apr, Jul, Sep 2026), adds the people below and merges J Sathwik's duplicate record.

- **Aug 2026** is still partly monthly: 1 day is missing from the screenshots, so a 1-day monthly total holds it until it is sent.
- **Removed students** (attended but left the team): Rishabh, Krishna Mule, Vipin, Pradeep, Tarun, Abhishek Raj Kumar, David Pratap Singh, Rajiv Karn, Purushottam, Karthik and Jangiti Sathwik Kumar (2501CS31, also listed as "Sathwik CS", "Sathwik Kumar", "J Sathwik"). Only the days they were present are stored. Team turnout figures count current players only.
- **New players** Rajesh (from 30 Sep) and Anish (from 2 Oct) are added as current players with no roll number. Add their rolls under Players.
- Saurabh Kumar is not on the 17-player team list, so he is not counted from September 2026 on.
- When a list in the group had a wrong date typed in it, the date WhatsApp shows for the message is used (12 Mar, 21 Aug). 29 Jan morning and evening are merged into one day. 9 Mar is inferred from the old monthly totals because the message was cut off.

## v9 additions

- **Tap for details:** Schedule days and player tiles open to show details. Tapping a player or admin opens a full **profile page** (attendance ring, streak, month by month, contact, jersey, edit, reset code, remove). Everyone can add their own photo.
- **Removed students** keep every detail (name, roll, contact, jersey, joined date, attendance) and show who removed them and when. Restore any time.
- **Graphs:** smooth turnout curve with average line and tooltips, day-wise table, per-player rings and streaks.
- **Share anywhere:** reports and messages use the phone's share sheet (any app), with fallbacks for WhatsApp, Telegram, e-mail, SMS and copy. ⋮ > **Share attendance report**: whole team, one date, one month, or one person (WhatsApp straight to their number). ⋮ > **Share this app**.
- **Umpire whistle** (Rules tab only) and drawn signal pictures (cards, goal, penalty corner...) instead of plain text.

## v10 additions

- **Log out** asks for confirmation first.
- **Availability** for each upcoming playing day: players tap Active / Injured / Can't come / Maybe (on Home and Playing days). Captain, vice-captain and admins see the counts and press **Availability** to see everyone, change anyone's status and share the list. Players only see their own answer. Stored in `avail/<date>`.
- **Edit playing days** (admins): **Edit** on any row changes date, time, venue and note. Availability moves with the date. The date is locked once attendance is saved for that day.
- **Venue** on every playing day (default Sports Complex, remembers your last one). It appears in the WhatsApp/share message (`{venue}`; added automatically to older custom templates), Home, reminders and the calendar file.
- The ⋮ menu no longer repeats tabs already on the bottom bar (or top bar on a laptop). It lists only _More pages_.

## v11 additions

- **Whistle only in Rules.** The header whistle and the whistle on login/save are gone. The Rules tab has the whistle card (four blasts, each with ▶ and when it is used) and a _Whistle rules_ section. Every button tap now makes a soft **click** instead (⋮ > Sound > Click sound).
- **Volume** slider: ⋮ > Sound, and on the Rules whistle card. One setting for clicks and whistle, kept on that phone.
- **Push notifications** (free Web Push): everyone who turns on ⋮ > _Push: day scheduled / cancelled_ (or taps **Turn on** on Home) gets a notification when a playing day is scheduled, cancelled, or restored, even with the app closed. Only for today or later; editing a day sends nothing.
  Setup, once: `npm install`, `npm run vapid`, put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel environment variables, redeploy. Without the keys the app works as before and the toggle says push is not set up.
  iPhone: works only after Share > Add to Home Screen and opening the app from the home screen (iOS 16.4+). Subscriptions are stored in `pushSubs/<id>`; log out removes that phone's subscription.
- **Availability reason.** Players choosing Injured / Can't come / Maybe can add a short reason; captain, vice-captain and admins see it in **Availability** (and in the shared list) and can edit it. Stored with the answer in `avail/<date>`.
- **Playing days = calendar.** A month calendar (dots: playing, attendance taken, cancelled); tap a date to see only that day. Admins can schedule from an empty date.
- **Schedule = one day at a time.** Tap Mon..Sun to see that day's details (and edit it, for admins).
- **Profile:** one entry only (the avatar in the header; the menu row is gone). New **Edit profile** button: players edit their own name, position, contact, e-mail and jersey details; admins edit anyone (including roll number and joining date). The attendance numbers and table are removed from the profile (they are in Stats); the chart (ring and recent-days strip) stays.

## v12 additions

- **Gallery** (menu, under More pages): everyone can add photos; admins can delete any photo, others only their own. Photos are resized in the phone and stored in Firestore (`gallery` = thumbnails, `galleryFull` = full pictures, max 200).
- **Home tab**: no attendance figures any more. It shows the team group photo (admins change it from the Home tab, the menu, or by opening a Gallery photo and pressing _Use as group photo_), the next playing day, upcoming Indian hockey fixtures, live match news, latest Indian hockey news and a short history timeline.
  - Fixtures come from a built-in list; admins can edit it in the menu (_Edit Indian hockey fixtures_). Past dates hide themselves.
  - News comes from the Google News feed through `/api/news` (cached 15 minutes, no key needed). If the server cannot reach it, the app says so.
- **Attendance tab**: new _Charts_ card with a line chart, grouped bar chart, horizontal bar chart and donut chart.
- Fixed: the _Share report_ button on the Attendance tab could stop working after opening it.
- No new environment variables. Redeploy, then reload the app once (the service worker cache is now `hk-v12`).

## v13 additions

- **Training & watch** (menu, under More pages): timer (stopwatch, countdown, intervals with whistle/beeps and keep-screen-on), live heart rate from a Bluetooth watch or chest strap, saved sessions and saved timer setups, and a "How to improve" card.
- Watch connection uses standard Bluetooth heart rate (Web Bluetooth): Chrome on Android or desktop only, not iPhone Safari. For watches that cannot share heart rate, sessions can be added by hand.
- Training data is private: stored in Firestore `workouts`, readable only by the person who saved it (not even by the captain). No new environment variables.

## v14 additions

- **Match timer (FIH style)** on the Training page: 4 quarters of 15 minutes, 2 minute breaks after Q1 and Q3, 10 minute half-time (all editable). Long whistle at the start of each quarter, final whistle at the end, Q1 to Q4 strip, score keeping (a goal stops the clock) and a Stop clock button for injuries and time-outs. Saved matches keep the score in the note.
- **Personal tips**: use your position, a "My focus" choice, last 30 days of practice attendance, an "Injured" availability mark, your saved sessions and your practice heart-rate trend. Many tips have a button that loads a matching timer setup.
- **Report a bug** (menu, everyone): description, page, optional screenshot and device details. The captain and vice-captain see them under _Bug reports_ (menu): share to WhatsApp or any app, mark fixed, delete. Stored in Firestore `bugs`.

## v15 additions

- **Take attendance** redone: previous/next day, search, "Unmarked only", All present / All absent / Clear, avatars, last-5 practice dots, availability badges (injured, can't come, maybe) with a one-tap "mark them absent", live Present / Absent / Left counts and a sticky Save bar.
- **Removed students** redone: summary, search, filter, sort, select many, bulk restore, bulk delete forever (type DELETE), and per card Restore, Edit, Call, WhatsApp and Delete forever.
- **Medals** 🥇🥈🥉 in the Attendance tab: a podium and medals in the table and the player bar chart (ties share a medal). Players see their own level instead (Gold 90%+, Silver 75%+, Bronze 60%+).
- **Watch**: "Try boAt / other watch" (scans for any Bluetooth device and tells you if it shares heart rate), "Add watch summary" now also takes steps and the watch name. boAt watches normally talk only to the boAt Crest app.

## Push notifications (one-time setup, captain / vice-captain)

No command line needed: open the app > ⋮ menu > **Set up push notifications**. It makes the keys and shows the steps:

1. Press **Generate keys**.
2. Vercel > your project > Settings > Environment Variables: add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:you@example.com`).
3. Vercel > Deployments > latest > ⋯ > **Redeploy**.
4. Every phone: ⋮ menu > _Push: day scheduled / cancelled_ ON > Allow. iPhone: Add to Home Screen first (iOS 16.4+).
5. Back in the setup window press **Send me a test**.

## Profiles

- Captain and vice-captain can be players too: ⋮ > _Edit captain & coach names_ > link each to their player record. They then get the normal player profile (roll no, position, jersey, attendance).
- Every profile can have a cover (background) picture. All photo uploads open a crop screen first.
- Adding an admin asks **Player or Instructor** (a player admin is linked to their player record).

## v18 additions

- **Schedule tab hardened.** The weekly schedule is rebuilt row by row when it loads, so a missing, short or damaged saved schedule falls back to the built-in week instead of leaving the tab blank. A page that fails to draw now shows a message and a _Reload data_ button instead of freezing. Service worker cache is now `hk-v18`.
- **Announcements on Home** (below the welcome card). Everybody reads them; admins use **＋ New**, Edit, Delete and can pin one to the top. Stored in Firestore `announcements/<id>` (title, text, tags, pinned, by, at).
- **Tagging** in announcements and in each Schedule day (admins: _Tag people_). Tag a player, or a group: Everyone, Goalkeepers, Forwards, Midfielders, Defenders (matched from the player's position). Tagged players see a highlighted "You are tagged" card and a dot on that day in the week strip. New announcements send a push notification to tagged players only (to everybody if _Everyone_ is tagged). Schedule rows keep their tags in `config/schedule` (`g`).
- **Day / night toggle**: ☀️/🌙 button in the header (also on the public page) and ⋮ > Appearance > _Night mode_. The choice is kept on that phone; _Use my phone's setting_ goes back to automatic.
- No new environment variables. Redeploy, then reload the app once.

## v18.1

- **Playing days calendar** now shows the weekly timetable: future days that have a timing get a dotted ring until scheduled. Tapping an unscheduled date shows what the timetable says, with **Schedule this day** and **Schedule the next 7 days** (admins). The note box no longer gets auto-filled by the phone.
- **Saves show up at once.** Vercel can run several server copies, each caching the data for 10 seconds, so a day you just added could be missing from the reload. After any save the app now asks for fresh data (`/api/data?fresh=1`). Cache is `hk-v20`.
- **Add playing day**: the save no longer waits more than 4 seconds for push notifications (a slow push service used to hold the reply). The Add button shows _Adding…_ and confirms when done.

## v18.2: slow internet and server errors

- **The screen no longer disappears.** The last good copy of the data is saved on the phone. If the connection is slow or drops, or the server errors, the app keeps showing it with a small bar ("Slow or no connection. Showing your last saved data.") and a **Retry** button, and keeps retrying by itself every 8 seconds. Opening the app with no connection shows the saved data straight away. Logging out clears it.
- Every request has a time limit (25 s, 90 s for photos) and repeats itself when safe (data loads 3 times, saves 2 times). Adding new things (POST) is never repeated, so nothing is saved twice. When a save fails, the message says so and the screen stays as it is.
- The app files also open from the phone's saved copy if the network takes more than 3.5 s (cache `hk-v22`).
- **Server fixes:** players never received announcements (fixed); an announcement without tags now notifies everybody (it used to notify nobody); if the database fails the server serves its last good copy instead of "Server error"; errors now say what happened (database daily limit reached, database slow, photo too large).

## v19

- **"Add" playing day was dead** because the Add button and a hidden login field shared the id `pa`, so the click handler went to the wrong element. Fixed (the timer's Reset button had the same kind of clash with `trs`). The Add message now also says how many phones were notified.
- **Tagging moved** from the Schedule tab to Playing days (add form, edit window, day card, calendar dot). Tagged players get their own "You are tagged" notification; everyone else gets the normal one.
- **Home**: the "my details" card is gone.
- **News** opens the article on the publisher's site (Bing News links are unwrapped, Google News is the backup), searches several topics, shows the newest first, and the ↻ button always fetches fresh.
- **Gallery** has Fitness / Practice / Match sections, a short description on every photo, and an Edit button (admins: any photo, players: their own).
- **Sign-up with an e-mailed code (Resend)**; phone numbers are no longer asked for anywhere. If the captain saved an e-mail for a player the code goes there, otherwise the player types one. Set `RESEND_API_KEY` and `RESEND_FROM` in Vercel (see `.env.example`). Old phone numbers stay in the database but are not shown or used.
- **Menu > Send me a test notification** says exactly why push does or does not reach a phone.

## v20

- **Smartwatch connection removed** (Bluetooth heart rate, QR scanner, watch fields). Old saved sessions still show their numbers.
- **My health log** (Training tab): steps, distance (km), sleep (hours), calories, height (cm), weight (kg), one entry per day, all optional, private to each person. Shows 7 day averages, latest weight/height and BMI, the last 14 days (edit or delete), and a sleep tip when the weekly average is under 7 hours. Stored in Firestore `health`.
- **Menu > Test the sign-up e-mail** (captain / vice-captain) sends a test e-mail so you can check the Resend and domain setup. See `EMAIL-SETUP.md`.
