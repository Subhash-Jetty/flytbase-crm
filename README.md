# FlytBase CRM — Account Quest Dashboard

A live CRM dashboard for the FlytBase Questathon, currently covering **Eastern Counties Police Alliance**, **Aldermoor Industrial Group**, and the released **Kestrel Estates** account.

## What it does

For each account, the CRM answers five questions a manager needs on Monday:

1. **What is the book worth?** — Every deal at a value backed by evidence, with unverified claims shown apart
2. **Who holds the power?** — For each deal: who decides, who pays, who uses it, who blocks it, and relationship status
3. **What do you do first?** — Top 3 moves, ranked, with owner and the deal each one advances
4. **What is about to go wrong?** — Deadlines at risk, deals stuck, people going cold
5. **What do you still not know?** — Gaps the plan rests on, and who could fill each one

## Live data

The dashboard reads the account export, released accounts, live signals and current MCP state. It spaces reads at least 65 seconds apart to respect the one-call-per-minute limit, and keeps a saved account snapshot available if MCP is unavailable. Account exports, signals, release checks and new-account reads are staggered; with all sources active, each is checked roughly every 4 minutes and 20 seconds. The manual Refresh button requests the account export.

**Value rule:** active potential is the sum of `worth_up_to` for priced opportunities, excluding deals marked `out_of_reach` or `agreed`. Agreed deal value is shown separately; unpriced opportunities are omitted. The dashboard recalculates from the latest account export, so stage or value updates from the game can change the total. These are opportunity ceilings, not booked revenue or the leaderboard score. When MCP is unavailable, the page labels the saved snapshot and its export time.

A newly released account is discovered from `whoami` when release identifiers are present and fetched with `get_new_account`. Kestrel Estates is also included as a labeled snapshot so the current released account stays visible while a live call is pending. New accounts returned inside `get_my_accounts` are merged automatically. Scenario-specific recommendations are curated for the three known accounts; other accounts get conservative blocker-based prompts and explicit unknowns.

This build does not yet persist account exports in a durable CRM database or hydrate every linked document with `get_all_paperwork` / `get_file`; the fallback is the checked-in scenario snapshot plus short-lived cache.

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

The MCP token is stored as a server-side environment variable (`AQ_TOKEN`). It never reaches the browser. API routes proxy MCP calls, use Next's short remote cache for reads, and keep a local per-instance cooldown. The cache reduces duplicate reads across supported server instances; it is not a distributed lock, so independent cold starts can still race the upstream rate limit. When that happens, the UI keeps the last good data or shows the saved snapshot.

Note writes are validated and restricted to same-origin browser requests, but the public write route does not authenticate individual users. Add an authenticated write gate before exposing note-writing access to untrusted visitors.

## Data sources

All numbers trace back to their source:
- Stakeholder quotes (fact IDs like `km_usage_1`, `sr_roi_2`)
- Data room files (`flight_log_force_month`, `helicopter_cost_overtime`, etc.)
- Verified vs. claimed vs. told status on every fact
