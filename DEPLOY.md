# TestCase Visual - VPS Deployment

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- PM2 (process manager)
- Nginx (reverse proxy)

## Setup Steps

### 1. Clone & Install
```bash
git clone <your-repo>
cd tiny-case-visual
npm install
```

### 2. Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE testcase_visual;"

# Update .env with your database URL
# postgresql://user:password@localhost:5432/testcase_visual?schema=public

# Run migrations
npx prisma migrate dev
```

### 3. Environment Variables
Create `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/testcase_visual?schema=public
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://your-domain.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### 4. Build & Start
```bash
npm run build
pm2 start npm --name "testcase-visual" -- start
```

### 5. Nginx Config (sample)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /uploads {
        alias /path/to/tiny-case-visual/uploads;
    }
}
```

## SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```