# AllCombiner — Production deployment guide

This document covers **all deployment scenarios** for AllCombiner. Pick the one that matches your hosting.

| Scenario | Best for | Section |
|---|---|---|
| **Hostinger VPS / Cloud** with PM2 | Recommended — full control, SSH access | [Section A](#a-hostinger-vps--cloud-with-pm2) |
| **Hostinger shared hosting** (hPanel) | Cheapest — no SSH | [Section B](#b-hostinger-shared-hosting-hpanel) |
| **Docker** (VPS or any cloud) | Reproducible, isolated | [Section C](#c-docker-deployment-any-vps) |
| **Vercel** | Zero-config, free tier | [Section D](#d-vercel-deployment) |

---

## A. Hostinger VPS / Cloud with PM2

**Prerequisites:** SSH access, Ubuntu 22.04+ or Debian 12+, Node.js 20+.

### 1. Connect your VPS to GitHub

In hPanel → **VPS → your server → Settings → SSH access** — note the IP, username (root), and password.

Or just SSH in directly:
```bash
ssh root@YOUR_VPS_IP
```

### 2. Install Node.js 20 + PM2 + git

```bash
# Add NodeSource repo and install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install PM2 globally
sudo npm install -g pm2

# Verify
node -v   # should print v20.x
pm2 -v    # should print 5.x+
git --version
```

### 3. Clone the repo

```bash
cd /var/www
git clone https://github.com/Akaprod/allcombiner.git
cd allcombiner
```

### 4. Configure `.env`

```bash
cp .env.production.example .env
nano .env
```

Fill in real values (see comments in the file):
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `ADMIN_PASSWORD` — choose a strong password
- `OPENROUTER_API_KEY` — your `sk-or-v1-...` key from https://openrouter.ai/keys

Save and exit (`Ctrl+X`, `Y`, `Enter`).

### 5. Run the deploy script

```bash
chmod +x deploy.sh
./deploy.sh
```

This will:
1. ✅ Verify environment
2. ✅ Install dependencies (`npm ci`)
3. ✅ Build Next.js for production
4. ✅ Apply database schema (`prisma db push`)
5. ✅ Seed admin user, AI models, pricing plans, default prompt
6. ✅ Start the app with PM2 (auto-restart on crash)

### 6. Set up auto-restart on reboot

```bash
pm2 startup systemd
# PM2 will print a command — copy-paste and run it
pm2 save
```

### 7. Set up Nginx + HTTPS (recommended)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp /var/www/allcombiner/nginx.conf /etc/nginx/sites-available/allcombiner
# Edit paths in the config to match your setup:
sudo nano /etc/nginx/sites-available/allcombiner
# Replace $(whoami)/allcombiner with /var/www/allcombiner
sudo ln -s /etc/nginx/sites-available/allcombiner /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Get HTTPS certificate
sudo certbot --nginx -d allcombiner.com -d www.allcombiner.com
```

### 8. Point your domain

In your domain registrar (or hPanel → Domains), create an **A record**:
- `@` → `YOUR_VPS_IP`
- `www` → `YOUR_VPS_IP`

Wait 5–30 min for DNS to propagate.

### 9. Verify

```bash
./deploy.sh status    # PM2 process should be "online"
./deploy.sh logs      # check for errors
curl http://localhost:3000/   # should return HTML
curl https://allcombiner.com/ # should return HTML with HTTPS
```

### 10. Auto-deploy on git push (optional)

Create `/var/www/allcombiner/.git/hooks/post-receive`:
```bash
#!/bin/bash
cd /var/www/allcombiner
git pull origin main
./deploy.sh
```
Then `chmod +x` it. Now every push to GitHub triggers a redeploy if you set up a webhook or pull manually.

**Better approach:** Set up a GitHub Actions workflow (see `.github/workflows/deploy.yml` — TODO if you want CI/CD).

---

## B. Hostinger shared hosting (hPanel)

**Limitations:** No SSH, no PM2, no persistent process. Only works if Hostinger's Node.js selector supports Next.js standalone output. **For AllCombiner we strongly recommend VPS.**

### 1. Connect GitHub in hPanel

1. hPanel → **Advanced → Git**
2. Click **"Create new deployment"**
3. Authorize Hostinger on GitHub
4. Select repo `Akaprod/allcombiner`, branch `main`
5. Destination: `public_html/allcombiner`
6. Click **"Deploy"**

### 2. Configure environment variables

hPanel → **Advanced → Node.js** → create app:
- Node.js version: **20**
- Application root: `public_html/allcombiner`
- Application URL: your domain
- Application startup file: `server.js` (after build)

Then in **"Environment variables"** add each var from `.env.production.example`:
- `NEXT_PUBLIC_APP_URL` = `https://allcombiner.com`
- `DATABASE_URL` = `file:./prod.db`
- `AUTH_SECRET` = (your random string)
- `OPENROUTER_API_KEY` = `sk-or-v1-...`
- etc.

### 3. Build the app

Use Hostinger's terminal (hPanel → **Advanced → Terminal** — available on some plans):
```bash
cd public_html/allcombiner
npm ci
npm run build
```

If no terminal: you'll need to build locally and upload `.next/standalone/` via File Manager.

### 4. Run database migration

```bash
cd public_html/allcombiner
npx prisma db push --accept-data-loss
npx prisma db seed    # or: npm run db:seed
```

### 5. Restart the Node.js app

In hPanel → Node.js → click **"Restart"** on your app.

---

## C. Docker deployment (any VPS)

**Best for:** Reproducible builds, easy rollbacks, isolated environment.

### 1. Install Docker on your VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in
```

### 2. Clone and configure

```bash
git clone https://github.com/Akaprod/allcombiner.git
cd allcombiner
cp .env.production.example .env
nano .env    # fill in real values
```

### 3. Build and run

```bash
docker compose up -d --build
```

### 4. Check logs

```bash
docker compose logs -f allcombiner
```

### 5. Update on new git push

```bash
git pull
docker compose up -d --build
```

### 6. HTTPS

Use the same Nginx config from [Section A](#a-hostinger-vps--cloud-with-pm2), pointing to `localhost:3000`.

---

## D. Vercel deployment

**Easiest, but:** Free tier has 10s function timeout — fusion requests (15-60s) will fail on free tier.

### 1. Import repo

Go to https://vercel.com/new → import `Akaprod/allcombiner`.

### 2. Configure environment variables

In Vercel project settings → **Environment Variables**, add all vars from `.env.production.example`.

### 3. Switch to PostgreSQL

Vercel doesn't support SQLite. Use Vercel Postgres or Neon:
1. Create a DB at https://neon.tech (free)
2. Get the connection string
3. Set `DATABASE_URL` in Vercel env vars
4. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`
5. Commit & push

### 4. Deploy

Vercel auto-deploys on every push to `main`. First deploy will run `prisma generate` automatically via `postinstall` script.

### 5. Run migrations

After first deploy:
```bash
# Locally, with DATABASE_URL pointed at your Vercel/Neon DB
npx prisma db push --accept-data-loss
npx prisma db seed
```

---

## Common operations (all scenarios)

### View logs

| Scenario | Command |
|---|---|
| PM2 | `pm2 logs allcombiner` |
| Docker | `docker compose logs -f allcombiner` |
| Vercel | Vercel dashboard → Logs |
| Shared hosting | hPanel → Logs |

### Update to a new version

```bash
cd /var/www/allcombiner
git pull origin main
./deploy.sh        # rebuild + restart
```

### Change admin password

Edit `.env` → change `ADMIN_PASSWORD` → run:
```bash
npm run db:seed    # updates the admin user
./deploy.sh restart
```

### Change AI model

Log in as admin → **/admin/models** → click "Set as active" on the desired model. No restart needed.

### Backup database (SQLite)

```bash
cp /var/www/allcombiner/prod.db /backups/allcombiner-$(date +%Y%m%d).db
```

For automated daily backups, add to crontab:
```bash
0 3 * * * cp /var/www/allcombiner/prod.db /backups/allcombiner-$(date +\%Y\%m\%d).db
```

---

## Troubleshooting

### App won't start

```bash
./deploy.sh logs
```
Common causes:
- `AUTH_SECRET` missing → generate with `openssl rand -base64 32`
- Port 3000 already in use → change `PORT` in `.env`
- Database file not writable → `chmod 755 /var/www/allcombiner`

### Build fails

```bash
./deploy.sh build
```
Common causes:
- Out of memory → add swap: `sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
- Node version too old → upgrade to Node 20+

### 502 Bad Gateway (Nginx)

App is not running. Check:
```bash
pm2 status
pm2 logs allcombiner
```

### HTTPS not working

```bash
sudo certbot certificates   # check cert status
sudo certbot renew --dry-run
```

### Database migration error

```bash
# Reset database (⚠️ destroys all data)
rm /var/www/allcombiner/prod.db
./deploy.sh migrate
./deploy.sh seed
```

---

## Quick reference — file map

| File | Purpose |
|---|---|
| `deploy.sh` | Main deploy script (PM2 path) |
| `ecosystem.config.cjs` | PM2 process config |
| `.env.production.example` | Template for production env vars |
| `Dockerfile` | Container build definition |
| `docker-compose.yml` | Container orchestration |
| `nginx.conf` | Reverse proxy + HTTPS |
| `.hostinger.yml` | Hostinger Git deployment config |
| `DEPLOY.md` | This document |
