# MXchatbot Unified Search - Render.com Deployment Guide

## 🚀 Quick Deploy Checklist

### ✅ Pre-Deployment
- [x] Code created and tested locally
- [x] Git repository initialized
- [x] Environment variables configured
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Render.com service created

### 🔧 Render.com Configuration

**Service Settings:**
- Name: `mxchatbot-unified-search`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: `Starter` (recommended) or `Free` (testing only)

**Environment Variables:**
```
NODE_ENV=production
PORT=10000
MXCHATBOT_API_KEY=f3d84194a418426b7b1115c1a5b44b35082e09760afc900362b449fc5873534e
ZENDESK_SUBDOMAIN=maintainx2936
ZENDESK_EMAIL=mike@getmaintainx.com
ZENDESK_API_TOKEN=FBpzTBGe4LCyFLWJq8qzJWYEMOoYKZ1ik0dNOuCr
```

### 🧪 Post-Deployment Testing

**Health Check:**
```bash
curl https://your-app-name.onrender.com/health
```

**Unified Search Test:**
```bash
curl -X POST https://your-app-name.onrender.com/api/search/unified \
  -H "Authorization: Bearer f3d84194a418426b7b1115c1a5b44b35082e09760afc900362b449fc5873534e" \
  -H "Content-Type: application/json" \
  -d '{"query": "password reset", "limit": 5}'
```

### 🔗 Integration with Main Backend

**Update your main chatbot backend environment:**
```
MXCHATBOT_API_URL=https://your-app-name.onrender.com
MXCHATBOT_API_KEY=f3d84194a418426b7b1115c1a5b44b35082e09760afc900362b449fc5873534e
```
