# 🚀 Render Deployment Guide - Connectora

## ✅ Quick Fix for "nxt: not found" Error

The error `sh: 1: nxt: not found` means there's a typo in your Render dashboard configuration.

### Solution: Update Render Dashboard Settings

1. **Go to your Render dashboard**
2. **Click on your service** (provider-mini-system)
3. **Go to Settings**
4. **Update the following:**

#### Build Command
```bash
npm install && npm run build
```
**⚠️ Make sure it says `npm run build` NOT `npm run buil` or `nxt build`**

#### Start Command
```bash
npm start
```

#### Environment Variables
Add these in the Environment section:
```
DATABASE_URL=your_mongodb_connection_string
NODE_ENV=production
PORT=3000
```

5. **Click "Save Changes"**
6. **Manually trigger a new deploy**

---

## 📋 Complete Render Configuration

### Option 1: Using Render Dashboard (Recommended)

#### Step 1: Create New Web Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select `provider-mini-system` repository

#### Step 2: Configure Service

**Name:** `connectora` (or your preferred name)

**Region:** Oregon (US West) or closest to you

**Branch:** `main`

**Root Directory:** Leave empty (or `.` if required)

**Runtime:** `Node`

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Plan:** Free (or your preferred plan)

#### Step 3: Add Environment Variables

Click "Advanced" → "Add Environment Variable"

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `mongodb+srv://user:pass@cluster.mongodb.net/connectora` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

**⚠️ Important:** Replace `DATABASE_URL` with your actual MongoDB connection string!

#### Step 4: Deploy

1. Click "Create Web Service"
2. Wait for deployment to complete
3. Check logs for any errors

---

### Option 2: Using render.yaml (Automatic)

A `render.yaml` file has been created in your project root. This will automatically configure your service.

**File:** `render.yaml`
```yaml
services:
  - type: web
    name: connectora
    env: node
    region: oregon
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: 20.11.0
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
```

**To use this:**
1. Commit and push `render.yaml` to your repository
2. In Render dashboard, click "New +" → "Blueprint"
3. Select your repository
4. Render will automatically detect `render.yaml`
5. Add your `DATABASE_URL` in the environment variables
6. Click "Apply"

---

## 🔧 Troubleshooting

### Error: "nxt: not found" or "next: not found"

**Cause:** Typo in build command or missing dependencies

**Solutions:**

1. **Check Render Dashboard Build Command**
   - Should be: `npm install && npm run build`
   - NOT: `npm run buil` or `nxt build`

2. **Verify package.json**
   ```json
   {
     "scripts": {
       "build": "npx next build"
     },
     "dependencies": {
       "next": "^15.5.18"
     }
   }
   ```

3. **Clear Render Cache**
   - Go to Settings → "Clear build cache & deploy"

### Error: "Cannot find module 'next'"

**Cause:** Dependencies not installed

**Solution:**
- Ensure build command includes `npm install`
- Build command should be: `npm install && npm run build`

### Error: "tsx: not found"

**Cause:** `tsx` not in dependencies

**Solution:** ✅ Already fixed - `tsx` is in dependencies

### Error: Database connection failed

**Cause:** Missing or incorrect `DATABASE_URL`

**Solution:**
1. Go to Render Dashboard → Your Service → Environment
2. Add `DATABASE_URL` with your MongoDB connection string
3. Ensure MongoDB allows connections from Render IPs (0.0.0.0/0 for testing)

### Error: Port already in use

**Cause:** Render assigns a dynamic port

**Solution:** Update `server.ts` to use `process.env.PORT`:
```typescript
const PORT = process.env.PORT || 3000;
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Build completes successfully (check logs)
- [ ] Service starts without errors
- [ ] Health check passes (if configured)
- [ ] Can access your service URL
- [ ] API endpoints respond correctly
- [ ] Database connection works
- [ ] Socket.IO connections work

### Test Your Deployment

```bash
# Replace YOUR_SERVICE_URL with your Render URL
curl https://YOUR_SERVICE_URL.onrender.com/api/services

# Expected response:
# {"success":true,"services":[...]}
```

---

## 📊 Expected Build Output

```
==> Cloning from https://github.com/RaghavDhingra-coder/provider-mini-system...
==> Checking out commit ec94944...
==> Using Node.js version 20.11.0 (default)
==> Running build command 'npm install && npm run build'...
==> Installing dependencies...
==> Building Next.js app...
    ✓ Compiled successfully
    ✓ Linting and checking validity of types
    ✓ Collecting page data
    ✓ Generating static pages (11/11)
==> Build successful!
==> Starting service with 'npm start'...
==> Server listening on port 3000
==> Deploy live at https://connectora.onrender.com
```

---

## 🎯 Common Mistakes to Avoid

1. ❌ **Typo in build command** - `npm run buil` instead of `npm run build`
2. ❌ **Missing npm install** - Build command should include `npm install`
3. ❌ **Wrong start command** - Should be `npm start` not `node server.js`
4. ❌ **Missing DATABASE_URL** - Must be set in environment variables
5. ❌ **devDependencies in production** - Ensure production deps are in `dependencies`

---

## 📝 Current Configuration

### package.json Scripts
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "npx next build",
    "start": "NODE_ENV=production tsx server.ts"
  }
}
```

### Dependencies (Production)
```json
{
  "dependencies": {
    "@types/node": "^22.15.21",
    "mongoose": "^8.14.3",
    "next": "^15.5.18",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1",
    "tsx": "^4.20.6",
    "typescript": "^5.8.3"
  }
}
```

---

## 🔄 Redeploying After Changes

### Automatic Deployment
Render automatically deploys when you push to `main` branch:
```bash
git add .
git commit -m "fix: update configuration"
git push origin main
```

### Manual Deployment
1. Go to Render Dashboard
2. Click on your service
3. Click "Manual Deploy" → "Deploy latest commit"

---

## 🆘 Still Having Issues?

### Check Render Logs
1. Go to Render Dashboard
2. Click on your service
3. Click "Logs" tab
4. Look for error messages

### Common Log Errors and Solutions

**"Error: Cannot find module 'next'"**
→ Add `npm install` to build command

**"sh: 1: nxt: not found"**
→ Fix typo in build command (should be `next` not `nxt`)

**"Error: connect ECONNREFUSED"**
→ Check DATABASE_URL is set correctly

**"Port 3000 is already in use"**
→ Ensure server.ts uses `process.env.PORT`

---

## 📞 Support Resources

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/)

---

## ✅ Final Checklist

Before deploying:
- [x] `next` in dependencies ✅
- [x] `tsx` in dependencies ✅
- [x] `typescript` in dependencies ✅
- [x] Build command: `npm install && npm run build` ✅
- [x] Start command: `npm start` ✅
- [x] `render.yaml` created ✅
- [ ] `DATABASE_URL` set in Render dashboard
- [ ] MongoDB allows Render connections
- [ ] Pushed latest changes to GitHub

---

**Last Updated:** May 18, 2026  
**Status:** Ready for Deployment 🚀
