"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Account, Signal } from "@/lib/types";
import { analyzeAccount, getFirstMoves, getGaps, getRisks } from "@/lib/analysis";
import { isAgreed, isOutOfReach, normalizeDealStage } from "@/lib/deal-stages";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + n.toLocaleString();
}

function relBadge(r: string) {
  const map: Record<string, string> = {
    ally: "bg-green-600 text-white",
    warm: "bg-yellow-500 text-black",
    neutral: "bg-gray-500 text-white",
    guarded: "bg-red-500 text-white",
  };
  return map[r] ?? "bg-gray-600 text-white";
}

function stageBadge(s: string) {
  const stage = normalizeDealStage(s);
  const map: Record<string, string> = {
    identified: "bg-blue-700",
    qualified: "bg-yellow-700",
    blocker_cleared: "bg-green-700",
    agreed: "bg-green-500",
    out_of_reach: "bg-gray-700 text-gray-300",
  };
  return map[stage] ?? "bg-gray-600";
}

function stageLabel(s: string) {
  const stage = normalizeDealStage(s);
  const map: Record<string, string> = {
    identified: "Identified",
    qualified: "Qualified",
    blocker_cleared: "Blocker cleared",
    agreed: "Agreed",
    out_of_reach: "Out of reach",
  };
  return map[stage] ?? stage.replaceAll("_", " ");
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    verified: "text-green-400",
    told: "text-yellow-400",
    claim: "text-red-400",
  };
  return map[s] ?? "text-gray-400";
}

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`crm-card bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      <h3 className="text-lg font-bold text-gray-200 mb-3 border-b border-gray-800 pb-2">{title}</h3>
      {children}
    </div>
  );
}

export function BookValue({ acct }: { acct: Account }) {
  const analysis = analyzeAccount(acct);
  const pricedOpportunityIds = acct.opportunities
    .filter(o => o.worth_up_to != null && !isOutOfReach(o.stage) && !isAgreed(o.stage))
    .map(o => o.id);
  const agreedDealIds = acct.opportunities.filter(o => o.worth_up_to != null && isAgreed(o.stage)).map(o => o.id);
  const wonOfferIds = acct.offers.filter(o => o.status === "won").map(o => o.id);
  const openOfferIds = acct.offers.filter(o => o.status === "open").map(o => o.id);
  const dealRows = acct.opportunities.map(o => {
    const evidence = o.evidence.join(", ");
    return (
      <tr key={o.id} className="border-b border-gray-800">
        <td className="py-2 pr-3">
          <span className="font-medium">{o.title}</span>
          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${stageBadge(o.stage)}`}>{stageLabel(o.stage)}</span>
        </td>
        <td className="py-2 pr-3 text-right font-mono">
          {fmt(o.worth_up_to)}
          {isOutOfReach(o.stage) && <div className="text-left text-xs text-gray-400 mt-1">Out of reach · excluded from active pipeline</div>}
          {isAgreed(o.stage) && <div className="text-left text-xs text-green-400 mt-1">Agreed · shown separately from active potential</div>}
          {o.evidence.includes("sr_roi_2") && <div className="text-left text-xs text-amber-400 mt-1">ROI unbooked · sr_roi_2</div>}
          <div className="text-left text-xs text-gray-500 mt-1">Record: {o.id}</div>
        </td>
        <td className="py-2 pr-3">
          {o.blocker ? (
            <span className={o.blocker.status === "open" ? "text-red-400" : "text-green-400"}>
              {o.blocker.status === "open" ? "⛔ " : "✅ "}{o.blocker.text}
            </span>
          ) : <span className="text-gray-500">None identified</span>}
        </td>
        <td className="py-2 text-xs text-gray-500 max-w-48 truncate" title={evidence}>{evidence}</td>
      </tr>
    );
  });

  const offerRows = acct.offers.map(o => (
    <tr key={o.id} className="border-b border-gray-800">
      <td className="py-2 pr-3">{o.title}</td>
      <td className="py-2 pr-3 text-right font-mono">{fmt(o.value)}</td>
        <td className="py-2 pr-3">{o.pitch_to}<div className="text-xs text-gray-500 mt-1">Record: {o.id}</div></td>
      <td className="py-2">
        <span className={`text-xs px-2 py-0.5 rounded ${o.status === "won" ? "bg-green-700" : o.status === "declined" ? "bg-red-700" : "bg-yellow-700"}`}>
          {o.status}
        </span>
      </td>
    </tr>
  ));

  return (
    <Card title="Q1 — What is the book worth?">
      <div className="mb-4 grid grid-cols-2 gap-3 text-center md:grid-cols-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">{fmt(analysis.totalPipeline)}</div>
          <div className="text-xs text-gray-400">Potential deal value</div>
          <div className="metric-source">Records: {pricedOpportunityIds.join(" · ") || "none"}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-400">{fmt(analysis.agreedDealValue)}</div>
          <div className="text-xs text-gray-400">Agreed deal value</div>
          <div className="metric-source">Records: {agreedDealIds.join(" · ") || "none"}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-400">{fmt(analysis.wonOffers)}</div>
          <div className="text-xs text-gray-400">Won offers</div>
          <div className="metric-source">Records: {wonOfferIds.join(" · ") || "none"}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-400">{fmt(analysis.openOffers)}</div>
          <div className="text-xs text-gray-400">Open offers</div>
          <div className="metric-source">Records: {openOfferIds.join(" · ") || "none"}</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Active potential {fmt(analysis.totalPipeline)} excludes {fmt(analysis.outOfReachValue)} marked out of reach and {fmt(analysis.agreedDealValue)} already agreed. Total priced deal ceiling is {fmt(analysis.totalOpportunityCeiling)}. These are opportunity estimates, not booked revenue.
      </p>
      <h4 className="font-semibold text-sm text-gray-300 mb-2">Deals</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm"><tbody>{dealRows}</tbody></table>
      </div>
      <h4 className="font-semibold text-sm text-gray-300 mt-4 mb-2">Offers</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm"><tbody>{offerRows}</tbody></table>
      </div>
    </Card>
  );
}

export function PowerMap({ acct }: { acct: Account }) {
  // Build role descriptions based on what we learned
  const roleDetails: Record<string, { decides: string; pays: string; uses: string; blocks: string }> = {};

  if (acct.id === "A") {
    roleDetails["rhys_calder"] = { decides: "Programme direction, board presentations", pays: "No — alliance can't commit force budgets", uses: "No — has never seen a dock fly", blocks: "Could if he oversells to the board" };
    roleDetails["karen_mbeki"] = { decides: "Operational deployment, who flies", pays: "No — requests budget through force", uses: "Yes — busiest unit, 14/18 docks active", blocks: "Staffing constraints (6 officers, needs 9 more)" };
    roleDetails["fatima_osei"] = { decides: "Data protection sign-off for Tarn Valley", pays: "No", uses: "No", blocks: "YES — DPIA unsigned, blocking 2 forces" };
    roleDetails["hannah_doyle"] = { decides: "Tender process, specification, evaluation", pays: "No — procurement process owner", uses: "No", blocks: "Spec locks soon without operating model" };
    roleDetails["ewan_brooks"] = { decides: "Builds the finance case; the CFO signs the Metro Central call-off", pays: "No — the force pays; its CFO signs", uses: "No", blocks: "No cost-per-flight comparison exists" };
  } else if (acct.id === "B") {
    roleDetails["stefan_roy"] = { decides: "Programme champion, case study owner", pays: "Budget comes from security allocation to plants", uses: "No — his deputy did all setups", blocks: "Could if case study uses unverified numbers" };
    roleDetails["beatriz_alonso"] = { decides: "Plant 7 operations", pays: "Pays annual allocation (resents it)", uses: "Yes — dock flies nightly for security", blocks: "Guard contractor doesn't cover drone alerts" };
    roleDetails["nadia_rahman"] = { decides: "Budget allocations, guard contracts", pays: "YES — controls finance allocations", uses: "No", blocks: "Could question ROI if numbers don't hold" };
    roleDetails["owen_fitch"] = { decides: "IT infrastructure for all plants", pays: "No", uses: "No", blocks: "Network issues at idle plants. IT wasn't involved in installs" };
    roleDetails["julian_tate"] = { decides: "Insurance and risk assessment", pays: "No — confirm the reported €180K annual premium reduction and its terms with the insurer", uses: "No", blocks: "Discount could be lost if plants stop flying" };
  } else if (acct.id === "C") {
    roleDetails["k_dana_1u9"] = { decides: "Estate operations and patrol scope", pays: "No — board vote needed for extra spend", uses: "No — no certified pilot is on site", blocks: "No pilot, no commissioning flight, installer unreachable" };
    roleDetails["k_graham_1u9"] = { decides: "Residents' board vote on security budget", pays: "Board approval controls spend beyond the purchase", uses: "No", blocks: "Could withhold renewal until the dock proves useful" };
    roleDetails["k_lucy_1u9"] = { decides: "Advises on insurer notification; insurer confirmation required", pays: "No", uses: "No", blocks: "Policy requires notice before the first flight" };
  }

  const evidenceByPerson: Record<string, string> = acct.id === "A" ? {
    rhys_calder: "rc_funding_2 · rc_tender_2",
    karen_mbeki: "km_usage_1 · km_staff_2",
    fatima_osei: "fo_dpia_2 · fo_needs_3",
    hannah_doyle: "hd_weights_1 · hd_window_2",
    ewan_brooks: "eb_heli_1 · eb_drone_2 · eb_sign_2",
  } : acct.id === "B" ? {
    stefan_roy: "sr_roi_2 · sr_repl_2 · sr_roll_2",
    beatriz_alonso: "ba_use_2 · ba_other_1 · ba_deputy_0",
    nadia_rahman: "No direct fact ID in the current export",
    owen_fitch: "ba_other_1 (Plant 11 network report; confirm IT sign-off with Owen)",
    julian_tate: "jt_prem_2 (reported by Neel Sharma; confirm with Julian)",
  } : acct.id === "C" ? {
    k_dana_1u9: "k_need_entrances_1u9 · k_no_pilot_1u9 · k_south_wish_1u9",
    k_graham_1u9: "k_board_pays_1u9 · k_board_doubts_1u9",
    k_lucy_1u9: "k_insurer_not_told_1u9 · K_insurance_schedule_1u9",
  } : Object.fromEntries(acct.stakeholders.map((stakeholder) => [stakeholder.id, "No source fact ID linked in the current export"]));
  const dealsByPerson: Record<string, string> = acct.id === "A" ? {
    rhys_calder: "Alliance renewal · tender",
    karen_mbeki: "Alliance renewal · Westmere · Tarn/Norwold · tender",
    fatima_osei: "Tarn Valley / Norwold",
    hannah_doyle: "300-dock tender",
    ewan_brooks: "Westmere · Metro Central call-off",
  } : acct.id === "B" ? {
    stefan_roy: "Renewal · idle plants · sister-company case",
    beatriz_alonso: "Renewal · idle plants",
    nadia_rahman: "Finance validation · renewal (confirm scope)",
    owen_fitch: "Idle plants / network remediation",
    julian_tate: "Renewal · insurance discount",
  } : acct.id === "C" ? {
    k_dana_1u9: "North-gate night-patrol go-live · south entrance assessment",
    k_graham_1u9: "Security-budget renewal vote",
    k_lucy_1u9: "North-gate go-live insurance notice",
  } : Object.fromEntries(acct.stakeholders.map((stakeholder) => [stakeholder.id, "Deal influence not established"]));

  return (
    <Card title="Q2 — Who holds the power? · roles & sentiment">
      <p className="text-xs text-gray-400 -mt-1 mb-3">Relationship labels reflect the account record; influence, responsibilities and supporting evidence are shown for each person.</p>
      <div className="space-y-3">
        {acct.stakeholders.map(s => {
          const details = roleDetails[s.id];
          return (
            <div key={s.id} className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-gray-400 text-sm ml-2">{s.role}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${relBadge(s.relationship)}`}>
                  {s.relationship}
                </span>
              </div>
              {details ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-blue-400 font-semibold">Decides:</span> {details.decides}</div>
                  <div><span className="text-green-400 font-semibold">Pays:</span> {details.pays}</div>
                  <div><span className="text-yellow-400 font-semibold">Uses it:</span> {details.uses}</div>
                  <div><span className="text-red-400 font-semibold">Could block:</span> {details.blocks}</div>
                  <div className="col-span-2 text-gray-400"><span className="text-gray-300">Deals:</span> {dealsByPerson[s.id] ?? "Confirm deal link"}</div>
                  <div className="col-span-2 text-gray-500"><span className="text-gray-400">Evidence:</span> {evidenceByPerson[s.id] ?? "No source ID in current export"}</div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Decision authority and deal influence are not established in the current account record.</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function FirstMoves({ acct, signals }: { acct: Account; signals: Signal[] }) {
  const moves = getFirstMoves(acct, signals);
  return (
    <Card title="Q3 — What do you do first?">
      <div className="space-y-3">
        {moves.map((m, i) => (
          <div key={i} className="fb-move-item bg-gray-800 rounded-lg p-3">
            <span className="fb-move-index">#{i + 1}</span>
            <div className="fb-move-main">
              <div className="font-semibold text-sm">{m.action}</div>
              <div className="text-xs text-gray-400 mt-1">
                <span className="text-yellow-400">Owner:</span> {m.owner} &nbsp;|&nbsp;
                <span className="text-green-400">Deal:</span> {m.deal}
                <div className="mt-1"><span className="text-yellow-400">Due:</span> {m.due} · <span className="text-gray-500">Source:</span> {m.evidence}</div>
              </div>
            </div>
            <span className="fb-move-urgency">{m.urgency}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Risks({ acct, signals }: { acct: Account; signals: Signal[] }) {
  const risks = getRisks(acct, signals);
  return (
    <Card title="Q4 — What is about to go wrong?">
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3 border-l-4 border-red-500">
            <div className="font-semibold text-sm text-red-300">⚠ {r.risk}</div>
            <div className="text-xs text-gray-300 mt-1">{r.impact}</div>
            <div className="text-xs mt-1">
              <span className="text-yellow-400">Deadline:</span> {r.deadline} &nbsp;|&nbsp;
              <span className="text-gray-500">Source:</span> {r.source}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Gaps({ acct, signals }: { acct: Account; signals: Signal[] }) {
  const gaps = getGaps(acct, signals);
  return (
    <Card title="Q5 — What do you still not know?">
      <div className="fb-gap-list">
        {gaps.map((g, i) => (
          <div key={i} className="fb-gap-item">
            <div className="fb-gap-heading">
              <span className="fb-gap-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-semibold text-sm">{g.gap}</span>
            </div>
            <div className="text-xs text-gray-300 mt-1">{g.why}</div>
            <div className="text-xs mt-1"><span className="text-blue-400">Ask:</span> {g.who}</div>
            <div className="text-xs text-gray-500 mt-1">Source: {g.source}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FactsTable({ acct }: { acct: Account }) {
  return (
    <Card title="Evidence Log" className="mt-4">
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-700">
              <th className="text-left py-1 pr-2">ID</th>
              <th className="text-left py-1 pr-2">Source</th>
              <th className="text-left py-1 pr-2">Status</th>
              <th className="text-left py-1">Fact</th>
            </tr>
          </thead>
          <tbody>
            {acct.facts.map(f => (
              <tr key={f.id} className="border-b border-gray-800">
                <td className="py-1 pr-2 font-mono text-gray-500">{f.id}</td>
                <td className="py-1 pr-2 text-gray-400">{f.said_by}</td>
                <td className={`py-1 pr-2 font-semibold ${statusBadge(f.status)}`}>
                  {f.status}{f.verified_by ? ` (${f.verified_by})` : ""}
                </td>
                <td className="py-1 text-gray-300">{f.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function SignalsPanel({ signals }: { signals: Signal[] }) {
  if (!signals || signals.length === 0) return null;
  return (
    <section className="fb-signals" aria-label="Live account signals">
      <div className="fb-signals-heading">
        <h2>Live account signals</h2>
        <span>{signals.length} updates</span>
      </div>
      <div className="fb-signals-list">
        {signals.map((s, i) => {
          let details: { summary?: string; dated?: string; records?: { kind?: string; path?: string }[] } = {};
          if (s.body) {
            try {
              const parsed: unknown = JSON.parse(s.body);
              if (parsed && typeof parsed === "object") details = parsed as typeof details;
            } catch { /* The body is already readable plain text. */ }
          }
          const summary = details.summary ?? s.body ?? "Signal received; details unavailable.";
          const signalDate = s.date || details.dated;
          const records = details.records?.map(record => record.path ?? record.kind).filter(Boolean) ?? [];
          return (
            <article key={`${s.id}-${i}`} className="fb-signal-item">
              <div className="fb-signal-topline">
                <h3>{s.title || `Signal ${i + 1}`}</h3>
                <span>{s.account ? `Account ${s.account}` : "Account update"}{signalDate ? ` · ${signalDate}` : ""}</span>
              </div>
              <p>{summary}</p>
              <div className="fb-signal-meta">{s.id}{records.length ? ` · ${records.join(" · ")}` : ""}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function NoteWriter({ accounts, selectedAccount }: { accounts: Account[]; selectedAccount: string }) {
  const [text, setText] = useState("");
  const [account, setAccount] = useState(selectedAccount);
  const [kind, setKind] = useState("next_step");
  const [status, setStatus] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    setStatus("Sending...");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, account, kind }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save note");
      setStatus("✓ Saved");
      setText("");
      setTimeout(() => setStatus(""), 2000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save note");
    }
  };

  return (
    <Card title="Write a note">
      <div className="space-y-2">
        <div className="flex gap-2">
          <select value={account} onChange={e => setAccount(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm">
            {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={kind} onChange={e => setKind(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm">
            <option value="next_step">Next Step</option>
            <option value="risk">Risk</option>
            <option value="note">Note</option>
          </select>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Your note..."
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm h-20 resize-none" />
        <div className="flex justify-between items-center">
          <span className="text-xs text-green-400">{status}</span>
          <button onClick={submit}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1 rounded text-sm font-semibold">
            Save Note
          </button>
        </div>
      </div>
    </Card>
  );
}
