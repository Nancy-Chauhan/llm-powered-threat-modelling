# Deployment Guide - Digital Ocean Droplet

This guide documents the complete deployment process for the Threat Modeling Dashboard on a Digital Ocean Droplet.

## Overview

| Component | Details |
|-----------|---------|
| Server | Digital Ocean Droplet ($6/mo) |
| OS | Ubuntu 22.04 with Docker |
| Domain | threatmodel.nancychauhan.com |
| SSL | Let's Encrypt (auto-renewing) |
| Database | PostgreSQL 16 (containerized) |
| LLM Provider | Anthropic Claude |

---

## Prerequisites

- Digital Ocean account
- Domain name (with DNS access)
- Anthropic or OpenAI API key
- `doctl` CLI installed locally (optional)

---

## Step 1: Create Droplet

### Option A: Via Digital Ocean Console

1. Go to [cloud.digitalocean.com/droplets](https://cloud.digitalocean.com/droplets)
2. Click **"Create Droplet"**
3. Configure:
   - **Region:** Choose closest to your users (e.g., `blr1` for Bangalore)
   - **Image:** Marketplace → **Docker on Ubuntu 22.04**
   - **Size:** Basic → Regular → **$6/mo** (1GB RAM, 25GB SSD)
   - **Authentication:** Add your SSH key
4. Click **"Create Droplet"**

### Option B: Via CLI (doctl)

```bash
# Authenticate
doctl auth init --access-token YOUR_DO_API_TOKEN

# Create droplet
doctl compute droplet create threat-modeling-app \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region blr1 \
  --ssh-keys YOUR_SSH_KEY_ID \
  --wait
```

---

## Step 2: SSH into Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

---

## Step 3: Clone Repository

```bash
git clone https://github.com/Nancy-Chauhan/llm-powered-threat-modelling.git
cd llm-powered-threat-modelling
```

---

## Step 4: Configure Environment Variables

Create a `.env` file:

```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/threat_modeling
CORS_ORIGINS=https://threatmodel.nancychauhan.com

# LLM Provider (choose one)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Or use OpenAI:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your-openai-api-key
# OPENAI_MODEL=gpt-4o
EOF
```

---

## Step 5: Update docker-compose.prod.yml

```bash
cat > docker-compose.prod.yml << 'EOF'
services:
  app:
    build: .
    ports:
      - '3001:3001'
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: threat_modeling
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
EOF
```

---

## Step 6: Build and Start Containers

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
- Build the Docker image (takes ~2-3 minutes first time)
- Start PostgreSQL database
- Start the application

---

## Step 7: Run Database Migrations

Install Bun on the droplet and run migrations:

```bash
# Install unzip (required for Bun)
apt-get update && apt-get install -y unzip

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Run migrations
cd llm-powered-threat-modelling/backend
bun install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/threat_modeling bunx drizzle-kit push --config=drizzle.config.ts
```

---

## Step 8: Verify Deployment

```bash
# Check containers are running
docker compose -f docker-compose.prod.yml ps

# Test health endpoint
curl http://localhost:3001/health

# Test frontend
curl http://localhost:3001/ | head -5
```

At this point, the app is accessible at `http://YOUR_DROPLET_IP:3001`

---

## Step 9: Configure Custom Domain

### 9.1 Add DNS Record

Go to your DNS provider (e.g., GoDaddy) and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `threatmodel` | `YOUR_DROPLET_IP` | 600 |

### 9.2 Install Nginx and Certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 9.3 Configure Nginx

```bash
cat > /etc/nginx/sites-available/threatmodel << 'EOF'
server {
    listen 80;
    server_name threatmodel.nancychauhan.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/threatmodel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
```

### 9.4 Open Firewall Ports

```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

### 9.5 Get SSL Certificate

Wait for DNS to propagate (check with `dig threatmodel.yourdomain.com`), then:

```bash
certbot --nginx -d threatmodel.nancychauhan.com --non-interactive --agree-tos --register-unsafely-without-email --redirect
```

### 9.6 Update CORS Origins

Update the `.env` file to use HTTPS domain:

```bash
cd ~/llm-powered-threat-modelling
sed -i 's|CORS_ORIGINS=.*|CORS_ORIGINS=https://threatmodel.nancychauhan.com|' .env
docker compose -f docker-compose.prod.yml restart app
```

---

## Final Result

Your app is now live at: **https://threatmodel.nancychauhan.com**

---

## Maintenance Commands

### View Logs

```bash
cd ~/llm-powered-threat-modelling
docker compose -f docker-compose.prod.yml logs -f
```

### Restart App

```bash
docker compose -f docker-compose.prod.yml restart
```

### Update to Latest Code

```bash
cd ~/llm-powered-threat-modelling
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Check Container Status

```bash
docker compose -f docker-compose.prod.yml ps
```

### Access Database

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d threat_modeling
```

---

## SSL Certificate Renewal

Let's Encrypt certificates auto-renew via a systemd timer. To manually renew:

```bash
certbot renew
```

To check renewal status:

```bash
certbot certificates
```

---

## Troubleshooting

### App not responding

```bash
# Check if containers are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs app --tail=50
```

### 502 Bad Gateway

The app container may be restarting. Wait a few seconds and check:

```bash
docker compose -f docker-compose.prod.yml ps
```

### Database connection issues

```bash
# Check if postgres is healthy
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
```

### DNS not resolving

```bash
# Check DNS propagation
dig threatmodel.nancychauhan.com @8.8.8.8
```

---

## Cost Summary

| Resource | Cost |
|----------|------|
| Droplet (1GB RAM) | $6/mo |
| Domain | Varies |
| SSL | Free (Let's Encrypt) |
| **Total** | **~$6/mo** |

---

## Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │         Digital Ocean Droplet       │
                    │            64.227.181.137           │
                    │                                     │
┌─────────┐        │  ┌─────────┐      ┌─────────────┐   │
│  User   │───────▶│  │  Nginx  │─────▶│   App       │   │
│ Browser │  HTTPS │  │  :443   │:3001 │  Container  │   │
└─────────┘        │  └─────────┘      └──────┬──────┘   │
                    │                          │          │
                    │                          ▼          │
                    │                   ┌─────────────┐   │
                    │                   │  PostgreSQL │   │
                    │                   │  Container  │   │
                    │                   └─────────────┘   │
                    └─────────────────────────────────────┘
```
