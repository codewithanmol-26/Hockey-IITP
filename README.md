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

## Run on your own computer
    npm install
    copy .env.example to .env and fill it in
    npm run dev        # open http://localhost:3000

## Privacy
Visitors who are not logged in only receive the roll-number list and the data of the one roll number they pick.
The codes live only in the server's environment variables, not in the web page.
