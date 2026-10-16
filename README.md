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
- **Public page (no login):** shows app features, captain, vice-captain, coach, team photos, fixtures and news. Players' names, contact details and attendance are never sent without a login. **Log in** opens the login page (✕ goes back). The captain sets the names under ⋮ > *Edit captain & coach names*.
- **Open in app / Continue in web** is asked once per browser session. A website cannot force-launch an installed app, so *Open in app* installs it (or explains how).
- **Attendance %** = days present ÷ total working days. The total is the same for every player; a missed day counts as absent.
- **Smartwatch:** Training tab > *Scan QR code on the watch*, then *Connect this watch* (Bluetooth). Live heart rate needs a watch that shares standard Bluetooth heart rate.
- **Login for the app itself:** after login, Home shows personal details and feature shortcuts.
  Players: roll number + their own code. Captain / Vice-captain / Admin: **Captain / Admin** tab.
- **Install as an app:** *Install app* on the login page or in the ⋮ menu (Chrome/Edge/Android). On iPhone: Safari > Share > Add to Home Screen. The icons are in `frontend/icons/`.
- **⋮ menu** lists every tab plus tools: Add students, WhatsApp template (admins), Alerts on/off, calendar file, Install, Hockey WhatsApp group, Log out. Each option appears once.
- **Admins** (Admins tab, captain/vice only): add with a name and code. Admins log in with *Admin* + their name + code. A switch turns an admin's access on or off at once, *Remove* deletes them.
- **Removed students** (admin tab): *Remove* in Players only hides a student (they are logged out, attendance history is kept). *Restore* brings them back with the same login code. *Delete forever* erases them.
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
Taken from the WhatsApp group screenshots and stored in `backend/seed.json` under `sessions` (75 days). On a fresh install *Import team* loads it. On an existing site open **Players** and press **Replace with day-wise attendance** (or **Re-apply register data** once it is loaded). It overwrites the attendance saved for those dates, deletes the old monthly totals that are now day-wise (Nov 2025, Jan to Apr, Jul, Sep 2026), adds the people below and merges J Sathwik's duplicate record.
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
- The ⋮ menu no longer repeats tabs already on the bottom bar (or top bar on a laptop). It lists only *More pages*.

## v11 additions
- **Whistle only in Rules.** The header whistle and the whistle on login/save are gone. The Rules tab has the whistle card (four blasts, each with ▶ and when it is used) and a *Whistle rules* section. Every button tap now makes a soft **click** instead (⋮ > Sound > Click sound).
- **Volume** slider: ⋮ > Sound, and on the Rules whistle card. One setting for clicks and whistle, kept on that phone.
- **Push notifications** (free Web Push): everyone who turns on ⋮ > *Push: day scheduled / cancelled* (or taps **Turn on** on Home) gets a notification when a playing day is scheduled, cancelled, or restored, even with the app closed. Only for today or later; editing a day sends nothing.
  Setup, once: `npm install`, `npm run vapid`, put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel environment variables, redeploy. Without the keys the app works as before and the toggle says push is not set up.
  iPhone: works only after Share > Add to Home Screen and opening the app from the home screen (iOS 16.4+). Subscriptions are stored in `pushSubs/<id>`; log out removes that phone's subscription.
- **Availability reason.** Players choosing Injured / Can't come / Maybe can add a short reason; captain, vice-captain and admins see it in **Availability** (and in the shared list) and can edit it. Stored with the answer in `avail/<date>`.
- **Playing days = calendar.** A month calendar (dots: playing, attendance taken, cancelled); tap a date to see only that day. Admins can schedule from an empty date.
- **Schedule = one day at a time.** Tap Mon..Sun to see that day's details (and edit it, for admins).
- **Profile:** one entry only (the avatar in the header; the menu row is gone). New **Edit profile** button: players edit their own name, position, contact, e-mail and jersey details; admins edit anyone (including roll number and joining date). The attendance numbers and table are removed from the profile (they are in Stats); the chart (ring and recent-days strip) stays.


## v12 additions
- **Gallery** (menu, under More pages): everyone can add photos; admins can delete any photo, others only their own. Photos are resized in the phone and stored in Firestore (`gallery` = thumbnails, `galleryFull` = full pictures, max 200).
- **Home tab**: no attendance figures any more. It shows the team group photo (admins change it from the Home tab, the menu, or by opening a Gallery photo and pressing *Use as group photo*), the next playing day, upcoming Indian hockey fixtures, live match news, latest Indian hockey news and a short history timeline.
  - Fixtures come from a built-in list; admins can edit it in the menu (*Edit Indian hockey fixtures*). Past dates hide themselves.
  - News comes from the Google News feed through `/api/news` (cached 15 minutes, no key needed). If the server cannot reach it, the app says so.
- **Attendance tab**: new *Charts* card with a line chart, grouped bar chart, horizontal bar chart and donut chart.
- Fixed: the *Share report* button on the Attendance tab could stop working after opening it.
- No new environment variables. Redeploy, then reload the app once (the service worker cache is now `hk-v12`).

## v13 additions
- **Training & watch** (menu, under More pages): timer (stopwatch, countdown, intervals with whistle/beeps and keep-screen-on), live heart rate from a Bluetooth watch or chest strap, saved sessions and saved timer setups, and a "How to improve" card.
- Watch connection uses standard Bluetooth heart rate (Web Bluetooth): Chrome on Android or desktop only, not iPhone Safari. For watches that cannot share heart rate, sessions can be added by hand.
- Training data is private: stored in Firestore `workouts`, readable only by the person who saved it (not even by the captain). No new environment variables.

## v14 additions
- **Match timer (FIH style)** on the Training page: 4 quarters of 15 minutes, 2 minute breaks after Q1 and Q3, 10 minute half-time (all editable). Long whistle at the start of each quarter, final whistle at the end, Q1 to Q4 strip, score keeping (a goal stops the clock) and a Stop clock button for injuries and time-outs. Saved matches keep the score in the note.
- **Personal tips**: use your position, a "My focus" choice, last 30 days of practice attendance, an "Injured" availability mark, your saved sessions and your practice heart-rate trend. Many tips have a button that loads a matching timer setup.
- **Report a bug** (menu, everyone): description, page, optional screenshot and device details. The captain and vice-captain see them under *Bug reports* (menu): share to WhatsApp or any app, mark fixed, delete. Stored in Firestore `bugs`.

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
4. Every phone: ⋮ menu > *Push: day scheduled / cancelled* ON > Allow. iPhone: Add to Home Screen first (iOS 16.4+).
5. Back in the setup window press **Send me a test**.

## Profiles
- Captain and vice-captain can be players too: ⋮ > *Edit captain & coach names* > link each to their player record. They then get the normal player profile (roll no, position, jersey, attendance).
- Every profile can have a cover (background) picture. All photo uploads open a crop screen first.
- Adding an admin asks **Player or Instructor** (a player admin is linked to their player record).

## v18 additions
- **Schedule tab hardened.** The weekly schedule is rebuilt row by row when it loads, so a missing, short or damaged saved schedule falls back to the built-in week instead of leaving the tab blank. A page that fails to draw now shows a message and a *Reload data* button instead of freezing. Service worker cache is now `hk-v18`.
- **Announcements on Home** (below the welcome card). Everybody reads them; admins use **＋ New**, Edit, Delete and can pin one to the top. Stored in Firestore `announcements/<id>` (title, text, tags, pinned, by, at).
- **Tagging** in announcements and in each Schedule day (admins: *Tag people*). Tag a player, or a group: Everyone, Goalkeepers, Forwards, Midfielders, Defenders (matched from the player's position). Tagged players see a highlighted "You are tagged" card and a dot on that day in the week strip. New announcements send a push notification to tagged players only (to everybody if *Everyone* is tagged). Schedule rows keep their tags in `config/schedule` (`g`).
- **Day / night toggle**: ☀️/🌙 button in the header (also on the public page) and ⋮ > Appearance > *Night mode*. The choice is kept on that phone; *Use my phone's setting* goes back to automatic.
- No new environment variables. Redeploy, then reload the app once.
