# World Is Your Study: put it online with GitHub + Firebase (free)

GitHub Pages hosts the app (the link your friends open).
Firebase stores accounts and progress (the database).
Uploading new files to GitHub never touches the database, so progress is never erased.

## Part 1: Firebase (database + login)
1. Open https://console.firebase.google.com, sign in with Google, click "Create a project".
2. Name it "world-is-your-study". Turn Google Analytics OFF and click Create project.
3. Left menu: Build → Authentication → Get started → Email/Password → switch ON "Email/Password" → Save.
4. Left menu: Build → Firestore Database → Create database → location "asia-south1 (Mumbai)" → Next → "Start in production mode" → Create.
5. In Firestore, open the "Rules" tab. Delete everything, paste ALL of firestore.rules from this folder, and click Publish.
6. Click the ⚙️ next to "Project Overview" → Project settings. Scroll to "Your apps" and click the </> (Web) icon. Give it a nickname and click "Register app" (leave the Hosting box unticked). You'll see a `firebaseConfig` block. Keep this page open.

## Part 2: connect the app to your database
7. Open firebase-config.js in Notepad and replace each YOUR_... value with the matching value from step 6. Save.

## Part 3: GitHub (the website)
8. Open https://github.com and sign in → "+" (top right) → New repository.
   Name: wiys. Choose Public. Click "Create repository".
9. Click "uploading an existing file". Drag in EVERYTHING from this folder, including the icons folder.
   Click "Commit changes".
10. Open the repo's Settings → Pages. Under "Branch" choose main and / (root), then Save.
    Wait 1–2 minutes and refresh. Your link appears: https://YOUR-GITHUB-NAME.github.io/wiys/
11. Back in Firebase: Authentication → Settings → Authorized domains → Add domain → YOUR-GITHUB-NAME.github.io

## Part 4: use it and share it
12. Open the link, create your account and finish the welcome steps.
13. Install it on your phone:
    - Android (Chrome): menu ⋮ → "Install app" or "Add to Home screen".
    - iPhone (Safari): Share → "Add to Home Screen".
14. Send the link to friends. Each person creates an account, then goes to Friends and searches your username.

## Updating later (the database stays safe)
- Change a file, then in GitHub click "Add file" → "Upload files", upload the changed file and commit.
- Open sw.js and change wiys-v1 to wiys-v2 (then v3, and so on) with every update so phones load the new version.
- Your database is only erased if you delete it yourself in Firebase. Never click "Delete project" or "Delete database".
- The "Reset my progress" button in the app clears only that one player's progress.
- You can see all the saved data anytime in Firebase → Firestore Database → Data.

## If something goes wrong
- "Couldn't save" or "Couldn't reach the database": step 5 rules weren't published, or firebase-config.js has a wrong value.
- The page shows "Preview mode": firebase-config.js still has YOUR_ values, or the new file wasn't uploaded.
- The link shows 404: wait 2 minutes after step 10 and check the repository is Public.
