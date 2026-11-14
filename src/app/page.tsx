"use client";
import { useEffect, useState, useCallback } from "react";
import type { ExportData, Account, Signal } from "@/lib/types";

// ─── helpers ─────────────────────────────────────────────
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
  const map: Record<string, string> = {
    identified: "bg-blue-700",
    qualified: "bg-yellow-700",
    "blocker_cleared": "bg-green-700",
    agreed: "bg-green-500",
  };
  return map[s] ?? "bg-gray-600";
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    verified: "text-green-400",
    told: "text-yellow-400",
    claim: "text-red-400",
  };
  return map[s] ?? "text-gray-400";
}

// ─── ANALYSIS ENGINE ─────────────────────────────────────
function analyzeAccount(acct: Account, allFiles: ExportData["files"]) {
  // Q1: Book value
  const backedDeals = acct.opportunities.filter(o => o.worth_up_to && o.blocker?.status !== "open" || o.stage === "qualified");
  const totalPipeline = acct.opportunities.reduce((s, o) => s + (o.worth_up_to ?? 0), 0);
  const wonOffers = acct.offers.filter(o => o.status === "won").reduce((s, o) => s + o.value, 0);
  const openOffers = acct.offers.filter(o => o.status === "open").reduce((s, o) => s + o.value, 0);

  // Q2: Power map
  const deciders = acct.stakeholders;

  // Q3: First moves
  const firstMoves = getFirstMoves(acct);

  // Q4: Risks
  const risks = getRisks(acct);

  // Q5: Gaps
  const gaps = getGaps(acct);

  return { totalPipeline, wonOffers, openOffers, firstMoves, risks, gaps };
}

function getFirstMoves(acct: Account): { action: string; owner: string; deal: string; urgency: string }[] {
  const moves: { action: string; owner: string; deal: string; urgency: string }[] = [];

  if (acct.id === "A") {
    // Police Alliance
    const tenderDeal = acct.opportunities.find(o => o.id === "a_tender");
    if (tenderDeal?.deadline && !tenderDeal.deadline.passed) {
      moves.push({
        action: "Submit written clarification to procurement requesting costed operating model be added to spec",
        owner: "You → Hannah Doyle",
        deal: "300-dock framework tender ($1.5M)",
        urgency: `${tenderDeal.deadline.moves_left} moves left before spec locks`,
      });
    }

    const westmereDeal = acct.opportunities.find(o => o.id === "a_westmere");
    if (westmereDeal?.deadline && !westmereDeal.deadline.passed) {
      moves.push({
        action: "Build cost-per-flight comparison (drone vs helicopter £1,500/hr) and send to Ewan Brooks",
        owner: "You → Ewan Brooks",
        deal: "Scale Westmere's fleet ($250K)",
        urgency: `${westmereDeal.deadline.moves_left} moves left — finance bid window closing`,
      });
    }

    const tarnDeal = acct.opportunities.find(o => o.id === "a_tarn");
    if (tarnDeal?.blocker?.status === "open") {
      moves.push({
        action: "Escalate internally: get data-flow documents (retention, storage, access controls) to Fatima Osei — 4 months overdue",
        owner: "You → Pranjal Suyal / SRV",
        deal: "Tarn Valley & Norwold go live ($200K)",
        urgency: "Blocks 2 forces + Norwold copies this assessment",
      });
    }
  } else {
    // Aldermoor
    const sisterDeal = acct.opportunities.find(o => o.id === "b_sister");
    if (sisterDeal?.blocker?.status === "open") {
      moves.push({
        action: "Get Nadia Rahman to verify the only hard saving (€180K insurance cut). The €1.2M figure is unverified — built from Stefan's spreadsheet, no guard contracts reduced",
        owner: "You → Nadia Rahman → Stefan Roy",
        deal: "Sister company case study ($1.2M)",
        urgency: "Case study cannot be credible without verified numbers",
      });
    }

    const idleDeal = acct.opportunities.find(o => o.id === "b_idle");
    if (idleDeal?.blocker?.status === "open") {
      moves.push({
        action: "Engage Owen Fitch (Group IT) to fix Plant 11 network. Document rollout steps from deputy before he leaves",
        owner: "You → Owen Fitch + Stefan's deputy",
        deal: "Bring idle plants into patrol ($180K)",
        urgency: "Deputy leaving soon — knowledge loss imminent",
      });
    }

    const renewalDeal = acct.opportunities.find(o => o.id === "b_renewal");
    if (renewalDeal?.blocker?.status === "open") {
      moves.push({
        action: "Connect with Julian Tate (insurance/risk) to document the €180K premium reduction and conditions for keeping it",
        owner: "You → Julian Tate",
        deal: "Renew Aldermoor contract ($140K)",
        urgency: "Insurance discount at risk if flying stops at plants",
      });
    }
  }
  return moves;
}

function getRisks(acct: Account): { risk: string; impact: string; deadline: string; source: string }[] {
  const risks: { risk: string; impact: string; deadline: string; source: string }[] = [];

  if (acct.id === "A") {
    const westmere = acct.opportunities.find(o => o.id === "a_westmere");
    if (westmere?.deadline && !westmere.deadline.passed) {
      risks.push({
        risk: "Metro Central finance bid window closing",
        impact: "Miss it = wait a year for next window. $250K+ at risk",
        deadline: `${westmere.deadline.moves_left} moves left`,
        source: "eb_window_2 (Ewan Brooks)",
      });
    }

    const tender = acct.opportunities.find(o => o.id === "a_tender");
    if (tender?.deadline && !tender.deadline.passed) {
      risks.push({
        risk: "Tender spec locks without operating model",
        impact: "40% of bid weighting has no answer. $1.5M deal weakened",
        deadline: `${tender.deadline.moves_left} moves left`,
        source: "rc_tender_2 (Rhys Calder), hd_weights_1 (Hannah Doyle)",
      });
    }

    risks.push({
      risk: "FlytBase silent since pilot — trust eroding",
      impact: "Hannah Doyle will score against us. Fatima's docs 4 months overdue",
      deadline: "Immediate",
      source: "hd_silence_3 (Hannah Doyle), fo_dpia_2 (Fatima Osei)",
    });

    risks.push({
      risk: "Rhys Calder leaving in January",
      impact: "Only alliance contact. No successor named. All prior calls were with him alone",
      deadline: "January",
      source: "Signal: Rhys Calder moving on (17 Nov)",
    });

    risks.push({
      risk: "Karen Mbeki's event on 5 Dec unanswered",
      impact: "Training dates and dock failure support needed. No reply sent",
      deadline: "This week",
      source: "Signal: Westmere public event (18 Nov)",
    });
  } else {
    risks.push({
      risk: "Stefan's deputy leaving — rollout knowledge unwritten",
      impact: "No one else knows how to set up plants. Sister company rollout at risk",
      deadline: "Soon — no exact date",
      source: "sr_repl_2 (Stefan Roy), ba_deputy_0 (Beatriz Alonso)",
    });

    risks.push({
      risk: "€1.2M savings figure is fabricated",
      impact: "Case study built on unverified numbers. Finance has booked nothing. Only €180K insurance cut is real",
      deadline: "Before case study goes to sister company",
      source: "sr_roi_2 (Stefan Roy), jt_prem_2 (Neel Sharma)",
    });

    risks.push({
      risk: "9 of 13 plants only log test flights",
      impact: "Real adoption is 4 plants, not 13. Insurance discount could be questioned",
      deadline: "Ongoing",
      source: "sr_roll_2 (Stefan Roy) verified by flight_log_by_plant",
    });

    risks.push({
      risk: "Plant managers resent head-office-imposed costs",
      impact: "Renewal friction. Plant 11 calls docks 'head office's toy'",
      deadline: "At renewal",
      source: "sr_plants_2 (Stefan Roy), ba_other_1 (Beatriz Alonso)",
    });

    risks.push({
      risk: "Three active docks stopped flying (Nov signal)",
      impact: "Plants that were flying have gone dark. No ticket raised",
      deadline: "Immediate",
      source: "Signal: Aldermoor 3 docks stopped (30 Nov)",
    });
  }
  return risks;
}

function getGaps(acct: Account): { gap: string; why: string; who: string }[] {
  const gaps: { gap: string; why: string; who: string }[] = [];

  if (acct.id === "A") {
    gaps.push({
      gap: "Cost per drone flight (staffing included)",
      why: "Cannot compare against £1,500/hr helicopter without it. Drone overtime is uncoded in payroll",
      who: "Ewan Brooks (payroll sign-off) + Karen Mbeki (flight hours)",
    });
    gaps.push({
      gap: "Who replaces Rhys Calder after January",
      why: "All institutional knowledge of the programme sits with him. No handover plan",
      who: "Rhys Calder / Alliance board",
    });
    gaps.push({
      gap: "Norwold chief constable's position on privacy",
      why: "Most skeptical board member. Privacy row over school overflight unresolved",
      who: "Fatima Osei (assessment) → Norwold chief",
    });
    gaps.push({
      gap: "Who flies 300 docks — staffing model",
      why: "6 officers today, need 9 more for just 30 docks. 300 is 10× that",
      who: "Karen Mbeki + operating model in tender spec",
    });
    gaps.push({
      gap: "Stadium project details — who asked, who pays, who flies",
      why: "Came from a superintendent's informal chat. No formal requirement",
      who: "Karen Mbeki + Ewan Brooks",
    });
  } else {
    gaps.push({
      gap: "Verified savings figure for case study",
      why: "€1.2M is theoretical. Only €180K insurance cut is real. Finance hasn't booked any saving",
      who: "Nadia Rahman (finance) + Julian Tate (insurance)",
    });
    gaps.push({
      gap: "Why 9 plants only test-fly",
      why: "Default patrol routes don't work. Plants need customisation nobody provides since deputy is leaving",
      who: "Owen Fitch (network) + Plant managers",
    });
    gaps.push({
      gap: "Guard contractor contract renewal dates",
      why: "Guard contracts don't cover drone alerts. Need to know when they renew to fix the gap",
      who: "Nadia Rahman (finance holds guard contracts)",
    });
    gaps.push({
      gap: "IT sign-off on dock network installations",
      why: "Group IT was never involved in installs. Potential compliance/security risk",
      who: "Owen Fitch (Group IT)",
    });
    gaps.push({
      gap: "Why 3 active docks stopped flying in November",
      why: "Signal received — no ticket raised, no one at customer has mentioned it",
      who: "Stefan Roy / Plant managers of affected plants",
    });
  }
  return gaps;
}

// ─── COMPONENTS ──────────────────────────────────────────

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      <h3 className="text-lg font-bold text-gray-200 mb-3 border-b border-gray-800 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function BookValue({ acct }: { acct: Account }) {
  const analysis = analyzeAccount(acct, []);
  const dealRows = acct.opportunities.map(o => {
    const evidence = o.evidence.join(", ");
    return (
      <tr key={o.id} className="border-b border-gray-800">
        <td className="py-2 pr-3">
          <span className="font-medium">{o.title}</span>
          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${stageBadge(o.stage)}`}>{o.stage}</span>
        </td>
        <td className="py-2 pr-3 text-right font-mono">{fmt(o.worth_up_to)}</td>
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
      <td className="py-2 pr-3">{o.pitch_to}</td>
      <td className="py-2">
        <span className={`text-xs px-2 py-0.5 rounded ${o.status === "won" ? "bg-green-700" : o.status === "declined" ? "bg-red-700" : "bg-yellow-700"}`}>
          {o.status}
        </span>
      </td>
    </tr>
  ));

  return (
    <Card title="Q1 — What is the book worth?">
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">{fmt(analysis.totalPipeline)}</div>
          <div className="text-xs text-gray-400">Pipeline (deals)</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-400">{fmt(analysis.wonOffers)}</div>
          <div className="text-xs text-gray-400">Closed (offers won)</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-400">{fmt(analysis.openOffers)}</div>
          <div className="text-xs text-gray-400">Open offers</div>
        </div>
      </div>
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

function PowerMap({ acct }: { acct: Account }) {
  // Build role descriptions based on what we learned
  const roleDetails: Record<string, { decides: string; pays: string; uses: string; blocks: string }> = {};

  if (acct.id === "A") {
    roleDetails["rhys_calder"] = { decides: "Programme direction, board presentations", pays: "No — alliance can't commit force budgets", uses: "No — has never seen a dock fly", blocks: "Could if he oversells to the board" };
    roleDetails["karen_mbeki"] = { decides: "Operational deployment, who flies", pays: "No — requests budget through force", uses: "Yes — busiest unit, 14/18 docks active", blocks: "Staffing constraints (6 officers, needs 9 more)" };
    roleDetails["fatima_osei"] = { decides: "Data protection sign-off for Tarn Valley", pays: "No", uses: "No", blocks: "YES — DPIA unsigned, blocking 2 forces" };
    roleDetails["hannah_doyle"] = { decides: "Tender process, specification, evaluation", pays: "No — procurement process owner", uses: "No", blocks: "Spec locks soon without operating model" };
    roleDetails["ewan_brooks"] = { decides: "Call-off sign-off for Metro Central", pays: "YES — CFO signs each force's call-off", uses: "No", blocks: "No cost-per-flight comparison exists" };
  } else {
    roleDetails["stefan_roy"] = { decides: "Programme champion, case study owner", pays: "Budget comes from security allocation to plants", uses: "No — his deputy did all setups", blocks: "Could if case study uses unverified numbers" };
    roleDetails["beatriz_alonso"] = { decides: "Plant 7 operations", pays: "Pays annual allocation (resents it)", uses: "Yes — dock flies nightly for security", blocks: "Guard contractor doesn't cover drone alerts" };
    roleDetails["nadia_rahman"] = { decides: "Budget allocations, guard contracts", pays: "YES — controls finance allocations", uses: "No", blocks: "Could question ROI if numbers don't hold" };
    roleDetails["owen_fitch"] = { decides: "IT infrastructure for all plants", pays: "No", uses: "No", blocks: "Network issues at idle plants. IT wasn't involved in installs" };
    roleDetails["julian_tate"] = { decides: "Insurance and risk assessment", pays: "No — but insurer's €180K discount is only real saving", uses: "No", blocks: "Discount could be lost if plants stop flying" };
  }

  return (
    <Card title="Q2 — Who holds the power?">
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
              {details && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-blue-400 font-semibold">Decides:</span> {details.decides}</div>
                  <div><span className="text-green-400 font-semibold">Pays:</span> {details.pays}</div>
                  <div><span className="text-yellow-400 font-semibold">Uses it:</span> {details.uses}</div>
                  <div><span className="text-red-400 font-semibold">Could block:</span> {details.blocks}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FirstMoves({ acct }: { acct: Account }) {
  const moves = getFirstMoves(acct);
  return (
    <Card title="Q3 — What do you do first?">
      <div className="space-y-3">
        {moves.map((m, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500">
            <div className="flex items-start justify-between">
              <span className="text-2xl font-bold text-blue-400 mr-3">#{i + 1}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{m.action}</div>
                <div className="text-xs text-gray-400 mt-1">
                  <span className="text-yellow-400">Owner:</span> {m.owner} &nbsp;|&nbsp;
                  <span className="text-green-400">Deal:</span> {m.deal}
                </div>
              </div>
              <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded ml-2 whitespace-nowrap">{m.urgency}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Risks({ acct }: { acct: Account }) {
  const risks = getRisks(acct);
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

function Gaps({ acct }: { acct: Account }) {
  const gaps = getGaps(acct);
  return (
    <Card title="Q5 — What do you still not know?">
      <div className="space-y-2">
        {gaps.map((g, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3 border-l-4 border-purple-500">
            <div className="font-semibold text-sm text-purple-300">❓ {g.gap}</div>
            <div className="text-xs text-gray-300 mt-1">{g.why}</div>
            <div className="text-xs mt-1"><span className="text-blue-400">Ask:</span> {g.who}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FactsTable({ acct }: { acct: Account }) {
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

function SignalsPanel({ signals }: { signals: Signal[] }) {
  if (!signals || signals.length === 0) return null;
  return (
    <div className="bg-red-950 border border-red-800 rounded-xl p-5 mb-6">
      <h3 className="text-lg font-bold text-red-300 mb-3">🔴 Live Signals</h3>
      <div className="space-y-2">
        {signals.map((s, i) => (
          <div key={i} className="bg-red-900/50 rounded-lg p-3">
            <div className="flex justify-between">
              <span className="font-semibold text-sm">{s.title ?? `Signal ${i + 1}`}</span>
              <span className="text-xs text-red-400">{s.date ?? s.account}</span>
            </div>
            <div className="text-sm text-gray-300 mt-1">{s.body ?? JSON.stringify(s)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteWriter() {
  const [text, setText] = useState("");
  const [account, setAccount] = useState("A");
  const [kind, setKind] = useState("next_step");
  const [status, setStatus] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    setStatus("Sending...");
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, account, kind }),
      });
      setStatus("✓ Saved");
      setText("");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Error");
    }
  };

  return (
    <Card title="📝 Write a Note">
      <div className="space-y-2">
        <div className="flex gap-2">
          <select value={account} onChange={e => setAccount(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm">
            <option value="A">Account A (Police)</option>
            <option value="B">Account B (Aldermoor)</option>
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

// ─── MAIN PAGE ───────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<ExportData | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("A");
  const [lastRefresh, setLastRefresh] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.accounts);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/signals");
      const json = await res.json();
      if (json.signals) setSignals(json.signals);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSignals();
    const interval = setInterval(() => {
      fetchSignals();
    }, 120000); // refresh signals every 2 min
    return () => clearInterval(interval);
  }, [fetchData, fetchSignals]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl text-gray-400 animate-pulse">Loading CRM data...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl text-red-400">Error: {error}</div>
    </div>
  );

  if (!data) return null;

  const acct = data.accounts.find(a => a.id === activeTab)!;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-blue-400">FlytBase</span> CRM
          </h1>
          <p className="text-gray-400 text-sm">Account Quest — Monday Handover Dashboard</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Last refresh: {lastRefresh}</div>
          <button onClick={() => { setLoading(true); fetchData(); fetchSignals(); }}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded mt-1">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">
            {fmt(data.accounts.reduce((s, a) => s + a.opportunities.reduce((ss, o) => ss + (o.worth_up_to ?? 0), 0), 0))}
          </div>
          <div className="text-xs text-gray-400">Total Pipeline</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {fmt(data.accounts.reduce((s, a) => s + a.offers.filter(o => o.status === "won").reduce((ss, o) => ss + o.value, 0), 0))}
          </div>
          <div className="text-xs text-gray-400">Closed Won</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {data.accounts.reduce((s, a) => s + a.stakeholders.length, 0)}
          </div>
          <div className="text-xs text-gray-400">Stakeholders</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400">
            {data.accounts.reduce((s, a) => s + a.opportunities.filter(o => o.blocker?.status === "open").length, 0)}
          </div>
          <div className="text-xs text-gray-400">Open Blockers</div>
        </div>
      </div>

      {/* Signals */}
      <SignalsPanel signals={signals} />

      {/* Account tabs */}
      <div className="flex gap-2 mb-6">
        {data.accounts.map(a => (
          <button key={a.id}
            onClick={() => setActiveTab(a.id)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              activeTab === a.id
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}>
            {a.id === "A" ? "🚔" : "🏭"} {a.name}
          </button>
        ))}
      </div>

      {/* Account header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h2 className="text-xl font-bold">{acct.name}</h2>
        <p className="text-sm text-gray-400 mt-1">Official story: {acct.official_story}</p>
        {acct.deadlines.length > 0 && (
          <div className="mt-2">
            {acct.deadlines.map((d, i) => (
              <span key={i} className={`inline-block text-xs px-2 py-1 rounded mr-2 ${d.passed ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}`}>
                ⏰ {d.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* The 5 Questions */}
      <div className="space-y-6">
        <BookValue acct={acct} />
        <PowerMap acct={acct} />
        <FirstMoves acct={acct} />
        <Risks acct={acct} />
        <Gaps acct={acct} />
        <FactsTable acct={acct} />
        <NoteWriter />
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 mt-8 pb-4">
        FlytBase CRM — Built by Subhash | Data live from MCP | {data.format}
      </div>
    </div>
  );
}
