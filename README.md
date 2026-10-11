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

## Admins, editing and the database
- Captain and vice-captain log in with the codes you set in Vercel. They can add more admins in **Players > Other admins** (name + code). Extra admins can take attendance and edit everything except that list. Removing an admin logs them out at once.
- Admins see **Edit** buttons for players, the weekly schedule, and (after pressing "Enable editing") the Rules and Warm-up pages, where each item can have a photo and a YouTube link.
- Press **Import team** once. It writes the 17 players and the monthly totals from your register to Firestore.
  If you imported with an older version, delete the `players` and `legacy` collections in the Firebase console and import again, so documents are named by roll number.

Firestore layout (you can open and edit these in the Firebase console):

    players/<roll number>    name, roll, position, joined (YYYY-MM-DD), n (list order)
    sessions/<YYYY-MM-DD>    r: { <roll number>: true or false }
    legacy/<YYYY-MM>         days, att: { <roll number>: days attended }
    plans/<YYYY-MM-DD>       time, note, status
    rules/<id>, warmup/<id>  title, icon, order, items [ {h, b, img, yt} ]
    config/schedule          team and gk (7 rows each)
    admins/<id>              name, salt, hash   (codes are never stored in plain text)

## Run on your own computer
    npm install
    copy .env.example to .env and fill it in
    npm run dev        # open http://localhost:3000

## Privacy
Visitors who are not logged in only receive the roll-number list and the data of the one roll number they pick.
The codes live only in the server's environment variables, not in the web page.
