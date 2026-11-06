# Turf Booking

A full-stack turf booking platform with online payments via Razorpay, owner subscription management, and an admin dashboard.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | Express 5, Node.js 18+ |
| Database | MySQL 8 |
| Payments | Razorpay (checkout + webhooks + RazorpayX payouts) |
| Auth | JWT (HTTP Bearer) |

## Project Structure

```
turf-booking/
├── backend/          Express API
│   ├── config/       DB pool, env validation
│   ├── db/
│   │   ├── schema.sql            Base database schema
│   │   └── migrations/           Incremental SQL migrations
│   ├── middleware/   Auth & role guards
│   ├── routes/       All API route files
│   ├── scripts/      One-off migration / utility scripts
│   ├── services/     Business logic (payments, payouts, notifications…)
│   └── uploads/      User-uploaded images & videos (gitignored)
└── frontend/         Next.js app
    └── src/
        ├── app/      Next.js App Router pages
        ├── components/
        ├── context/  AuthContext
        ├── hooks/    useAuth, useApi
        ├── lib/      Axios instance
        └── types/    Shared TypeScript types
```

## Quick Start (Development)

### Prerequisites
- Node.js ≥ 18
- MySQL 8 running locally (or via Docker — see below)

### 1. Database

```bash
mysql -u root -p < backend/db/schema.sql
```

Apply any pending migrations:
```bash
cd backend && node scripts/run_phase1.js
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # fill in your values
npm install
npm run dev                 # starts on :5000
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in your values
npm install
npm run dev                        # starts on :3000
```

### 4. Using Docker Compose (optional)

```bash
docker compose up --build
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default 5000) |
| `NODE_ENV` | Yes | `development` or `production` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Yes | MySQL connection |
| `JWT_SECRET` | Yes | ≥ 32 chars in production |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `FRONTEND_URL` | Yes | CORS allowed origin |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Production | Webhook signature key |
| `RAZORPAY_ACCOUNT_NUMBER` | Payouts | RazorpayX current account |
| `SETTLEMENT_MODE` | No | `route` (default) or `payout` |
| `PLATFORM_FEE_PERCENT` | No | Fallback commission % (default 2) |
| `PAYOUT_SIMULATE` | Dev | `true` to skip real RazorpayX calls |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` / `FROM` | No | Email for booking confirmations |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key (safe in browser) |
| `NEXT_PUBLIC_API_HOST` | Backend hostname for Next.js image optimisation |

## Default Admin

After running the schema seed:

| Email | Password |
|---|---|
| admin@turf.com | Admin@123 |

> **Change this immediately in production.**

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] `JWT_SECRET` ≥ 32 random characters
- [ ] `RAZORPAY_WEBHOOK_SECRET` set and webhook URL registered in Razorpay dashboard
- [ ] MySQL root password changed, dedicated DB user with minimal privileges
- [ ] Run behind HTTPS (Nginx reverse proxy or cloud load balancer)
- [ ] `uploads/` stored on a persistent volume or S3 (not in the container image)
- [ ] Configure `SMTP_*` with a real transactional email provider

## License

ISC

