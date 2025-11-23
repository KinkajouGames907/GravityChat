# 🚀 Deploying Gravity Chat

You have a local Git repository ready. Follow these steps to put it online.

## 1. Create a GitHub Repository
1.  Go to [github.com/new](https://github.com/new).
2.  **Repository name**: `gravity-chat` (or whatever you like).
3.  **Visibility**: Public or Private (your choice).
4.  **Do NOT** check "Initialize with README", .gitignore, or license (we already have these).
5.  Click **Create repository**.

## 2. Push Your Code
Copy the commands under **"…or push an existing repository from the command line"** from the GitHub page. They will look like this (replace `YOUR_USERNAME` with your actual GitHub username):

```bash
git remote add origin https://github.com/YOUR_USERNAME/gravity-chat.git
git branch -M main
git push -u origin main
```

Run these commands in your terminal here.

## 3. Deploy to the Web (Vercel)
The easiest way to host a Vite/React app is **Vercel**.

1.  Go to [vercel.com](https://vercel.com) and Sign Up/Login (you can use your GitHub account).
2.  Click **"Add New..."** -> **"Project"**.
3.  Select your `gravity-chat` repository from the list.
4.  Click **Import**.
5.  **Environment Variables**:
    *   You need to add your Firebase config here so the live site works.
    *   Open your local `.env` file.
    *   In Vercel, copy/paste each key-value pair into the "Environment Variables" section.
        *   `VITE_API_KEY` = `...`
        *   `VITE_AUTH_DOMAIN` = `...`
        *   etc.
6.  Click **Deploy**.

🎉 **Done!** Vercel will give you a live URL (e.g., `gravity-chat.vercel.app`) that you can share.

## 4. ⚠️ IMPORTANT: Fix Firebase Errors
If you see "auth/unauthorized-domain" errors, you must tell Firebase that your Vercel site is safe.

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click **Authentication** -> **Settings** tab -> **Authorized domains**.
3.  Click **Add domain**.
4.  Paste your Vercel URL (e.g., `gravity-chat.vercel.app`) without `https://`.
5.  Click **Add**.

Now your login will work!
