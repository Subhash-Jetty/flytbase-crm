# FlytBase CRM — Account Quest Dashboard

A live CRM dashboard for managing two FlytBase accounts: **Eastern Counties Police Alliance** and **Aldermoor Industrial Group**. Built for the FlytBase Questathon.

## What it does

For each account, the CRM answers five questions a manager needs on Monday:

1. **What is the book worth?** — Every deal at a value backed by evidence, with unverified claims shown apart
2. **Who holds the power?** — For each deal: who decides, who pays, who uses it, who blocks it, and relationship status
3. **What do you do first?** — Top 3 moves, ranked, with owner and the deal each one advances
4. **What is about to go wrong?** — Deadlines at risk, deals stuck, people going cold
5. **What do you still not know?** — Gaps the plan rests on, and who could fill each one

## Live data

The dashboard reads live from the Questathon MCP API. Signals (live events) auto-refresh every 2 minutes. Notes can be written back through the UI.

## How to run locally

```bash
# 1. Clone the repo
git clone <repo-url>
cd flytbase-crm

# 2. Install dependencies
npm install

# 3. Set your MCP token (never commit this)
echo "AQ_TOKEN=your-token-here" > .env.local

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `AQ_TOKEN` as an environment variable in Vercel project settings
4. Deploy

## Tech stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Vercel** for hosting

## Architecture

```
Browser  →  Next.js API Routes  →  MCP Server
                (token stays server-side)
```

The MCP token is stored as a server-side environment variable (`AQ_TOKEN`). It never reaches the browser. API routes proxy all MCP calls.

## Data sources

All numbers trace back to their source:
- Stakeholder quotes (fact IDs like `km_usage_1`, `sr_roi_2`)
- Data room files (`flight_log_force_month`, `helicopter_cost_overtime`, etc.)
- Verified vs. claimed vs. told status on every fact
