# FlytBase CRM — thinking note

## What it does

This is an evidence-led account dashboard for a FlytBase customer success manager handling the Eastern Counties Police Alliance, Aldermoor Industrial Group, and Kestrel Estates. It brings opportunity value, blockers, stakeholders, first moves, risks, unknowns, live signals, and source IDs into one review. When `whoami` exposes a newly released account, the dashboard asks the MCP for that account and adds it to the portfolio.

## How it decides

The recommendations are explicit, curated rules for the Questathon scenarios, not an LLM or a general-purpose CRM engine. They prioritize a blocker that can still be cleared before its deadline, name an owner, and cite the evidence behind the recommendation. Live events can reorder the relevant account’s actions and risks. New accounts without curated rules receive a conservative view of open blockers, recorded deadlines, and evidence gaps.

The dashboard separates qualified opportunity ceilings from booked revenue. For Aldermoor, Stefan Roy’s €1.2M estimate is an unbooked spreadsheet claim (`sr_roi_2`); the €180K annual insurance reduction is reported by Neel Sharma (`jt_prem_2`) and is not independently verified in this export. For Eastern Counties, 14 of 18 docks flew last month (`km_usage_1`), while the 300-dock operating model and staffing remain unresolved (`hd_weights_1`, `km_staff_2`). For Kestrel, the north dock has not had a commissioning flight (`k_not_commissioned_1u9`, `K_install_note_1u9`), and the policy requires insurer notification before use (`k_insurer_not_told_1u9`, `K_insurance_schedule_1u9`).

The CRM does not calculate the public leaderboard or the separate final-judging score. It shows the opportunity ceilings and evidence available in the account records; those are not the same as the game’s weighted score or cash booked.

## What it does not know or do

- It does not infer missing facts. For example, it does not assume why every Aldermoor plant only test-flies, that the €1.2M estimate is realized savings, or that Kestrel’s second dock is approved or priced.
- The account-specific recommendations are maintained in code. They need review when scenario rules or account facts change; a new account gets a cautious generic fallback until its case is understood.
- The dashboard cites file IDs found in the account export, but it does not yet fetch and retain every full paperwork record or file through `get_all_paperwork` / `get_file`.
- There is no durable customer-data database configured. The current fallback is a checked-in account snapshot plus short-lived remote reads; a cold start can reconstruct the view, but it is not a persistent CRM store.
- MCP reads are cached and rotated to respect the one-call-per-minute limit. The app has process-local rate limiting plus shared read caching, but no distributed lock or durable job queue. A cold start or concurrent server instances can still collide with that limit.
- Notes are sent to the MCP, but the note endpoint has no user login. Same-origin checks and input validation reduce accidental or cross-site writes; they do not authenticate a user.

## How AI was used

AI helped organize the assignment, compare account statements with their evidence, draft the scenario rules and surface unknowns. The dashboard’s recommendations are deterministic code; it does not make live AI judgments. All displayed opportunity figures and account claims come from the supplied game records or MCP response, with their evidence status kept visible.
