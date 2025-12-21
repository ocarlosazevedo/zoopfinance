# Zoop Finance

Financial management platform for global entrepreneurs. Track profits, manage payroll, and analyze transactions across multiple bank accounts and currencies.

## Features

- 📊 **Dashboard Overview** - Real-time profit/loss tracking with monthly breakdowns
- 💳 **Transaction Management** - Import and categorize transactions from multiple banks
- 👥 **Payroll Management** - Track base salaries and variable compensation
- 🏦 **Multi-Bank Support** - Revolut, Relay, Mercury, Wise, and more
- 🌍 **Multi-Currency** - Handle USD, EUR, GBP, BRL seamlessly

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Getting Started

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase-schema.sql`
3. Copy your project URL and anon key

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Add your Supabase credentials to `.env.local`

### 3. Run Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Push to GitHub and import in Vercel. Add environment variables and deploy!

## License

MIT
