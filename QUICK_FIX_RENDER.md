# 🚨 QUICK FIX - Render "nxt: not found" Error

## ⚡ Immediate Action Required

Your Render deployment is failing because of a **typo in the build command**.

---

## 🔧 Fix in 3 Steps

### Step 1: Go to Render Dashboard
1. Open https://dashboard.render.com/
2. Click on your service: **provider-mini-system**
3. Click **"Settings"** in the left sidebar

### Step 2: Fix Build Command
Scroll down to **"Build & Deploy"** section

**Current (WRONG):**
```
npm run buil
```
or
```
nxt build
```

**Change to (CORRECT):**
```
npm install && npm run build
```

### Step 3: Save and Redeploy
1. Click **"Save Changes"** at the bottom
2. Go back to your service dashboard
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## ✅ Verify It's Fixed

Watch the deployment logs. You should see:

```
✓ Running build command 'npm install && npm run build'...
✓ Installing dependencies...
✓ Building Next.js app...
✓ Compiled successfully
✓ Build successful!
```

---

## 🎯 What Was Wrong?

The error `sh: 1: nxt: not found` means:
- There's a typo: `nxt` instead of `next`
- OR the build command is missing `npm install`
- OR there's a typo in `npm run build` (like `npm run buil`)

---

## 📋 Correct Configuration

### Build Command
```bash
npm install && npm run build
```

### Start Command
```bash
npm start
```

### Environment Variables
```
DATABASE_URL=your_mongodb_connection_string
NODE_ENV=production
PORT=3000
```

---

## 🆘 Still Not Working?

### Option 1: Use render.yaml (Automatic)
1. The `render.yaml` file is now in your repo
2. In Render dashboard, delete your current service
3. Click "New +" → "Blueprint"
4. Select your repository
5. Render will auto-configure from `render.yaml`
6. Just add your `DATABASE_URL`

### Option 2: Check These
- [ ] Build command is exactly: `npm install && npm run build`
- [ ] Start command is exactly: `npm start`
- [ ] No typos in the commands
- [ ] DATABASE_URL is set in environment variables
- [ ] Latest code is pushed to GitHub

---

## 📞 Need More Help?

See the complete guide: **RENDER_DEPLOYMENT_GUIDE.md**

---

**Quick Summary:**
1. Go to Render Settings
2. Change build command to: `npm install && npm run build`
3. Save and redeploy
4. Done! ✅
