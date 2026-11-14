"use client";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import type { ExportData, Account, Signal } from "@/lib/types";
import { getAccountReadout } from "@/lib/analysis";
import { BookValue, FactsTable, FirstMoves, Gaps, NoteWriter, PowerMap, Risks, SignalsPanel } from "@/components/crm-panels";
import { isAgreed, isOutOfReach } from "@/lib/deal-stages";

// ─── helpers ─────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + n.toLocaleString();
}

function discoverReleasedAccountRefs(value: unknown): string[] {
  const found = new Set<string>();
  const accountKey = /(?:new|released).*accounts?|accounts?.*(?:new|released)/i;
  const addValue = (candidate: unknown) => {
    if (typeof candidate === "string" && candidate.trim()) {
      found.add(candidate.trim());
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(addValue);
      return;
    }
    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      for (const key of ["id", "name", "account"]) {
        if (typeof record[key] === "string" && record[key]) found.add(record[key] as string);
      }
    }
  };
  const walk = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(walk);
    } else if (candidate && typeof candidate === "object") {
      for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
        if (accountKey.test(key)) addValue(child);
        walk(child);
      }
    } else if (typeof candidate === "string") {
      const matches = candidate.matchAll(/new account(?: released| available| is)?[:\s]+([A-Z][A-Za-z0-9 &'’-]+)/gi);
      for (const match of matches) found.add(match[1].trim());
    }
  };
  walk(value);
  return [...found];
}

// ─── MAIN PAGE ───────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<ExportData | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("A");
  const [lastRefresh, setLastRefresh] = useState("");
  const [dataStale, setDataStale] = useState(false);
  const [signalsStale, setSignalsStale] = useState(true);
  const [whoamiStale, setWhoamiStale] = useState(true);
  const [newAccountStale, setNewAccountStale] = useState(true);
  const [hasEverLiveData, setHasEverLiveData] = useState(false);
  const [fallbackAccountIds, setFallbackAccountIds] = useState<string[]>([]);
  const dataRef = useRef<ExportData | null>(null);
  const signalsRef = useRef<Signal[]>([]);
  const liveAccountIds = useRef(new Set<string>());
  const releasedAccountRefs = useRef(["Kestrel Estates", "C"]);
  const releasedAccountIndex = useRef(0);
  const scheduleNextPollRef = useRef<(() => void) | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const incoming = json.accounts as ExportData;
      const missingLiveAccounts = Array.isArray(json.fallbackAccountIds) ? json.fallbackAccountIds as string[] : [];
      const previous = dataRef.current;

      if (json.stale && previous) {
        setDataStale(true);
      } else {
        const accounts = incoming.accounts.map((account) => {
          if (missingLiveAccounts.includes(account.id) && liveAccountIds.current.has(account.id)) {
            return previous?.accounts.find((known) => known.id === account.id) ?? account;
          }
          return account;
        });
        const merged = { ...incoming, accounts };
        dataRef.current = merged;
        setData(merged);
        setDataStale(Boolean(json.stale));
        setFallbackAccountIds(missingLiveAccounts.filter((id) => !liveAccountIds.current.has(id)));
        if (!json.stale) {
          setHasEverLiveData(true);
          for (const account of incoming.accounts) {
            if (!missingLiveAccounts.includes(account.id)) liveAccountIds.current.add(account.id);
          }
          setError("");
        }
      }
      if (json.stale && !previous) {
        dataRef.current = incoming;
        setData(incoming);
        setDataStale(true);
        setFallbackAccountIds(missingLiveAccounts);
      }
      if (!json.stale) setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      if (!dataRef.current) setError(e instanceof Error ? e.message : "Failed to load");
      else setDataStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      const json = await res.json();
      if (Array.isArray(json.signals)) {
        if (!json.stale || signalsRef.current.length === 0) {
          signalsRef.current = json.signals;
          setSignals(json.signals);
        }
        setSignalsStale(Boolean(json.stale));
        if (!json.stale) {
          setHasEverLiveData(true);
          setLastRefresh(new Date().toLocaleTimeString());
        }
      } else {
        setSignalsStale(true);
      }
    } catch {
      setSignalsStale(true);
    }
  }, []);

  const fetchWhoAmI = useCallback(async () => {
    try {
      const res = await fetch("/api/whoami", { cache: "no-store" });
      const json = await res.json();
      setWhoamiStale(Boolean(json.stale));
      if (!json.stale) {
        setHasEverLiveData(true);
        const refs = discoverReleasedAccountRefs(json.state);
        const nextRefs = [...releasedAccountRefs.current, ...refs].filter((ref, index, all) => all.indexOf(ref) === index);
        releasedAccountRefs.current = nextRefs;
        setLastRefresh(new Date().toLocaleTimeString());
      }
    } catch {
      setWhoamiStale(true);
    }
  }, []);

  const fetchNewAccount = useCallback(async () => {
    const refs = releasedAccountRefs.current;
    if (refs.length === 0) return;
    const identifier = refs[releasedAccountIndex.current % refs.length];
    releasedAccountIndex.current += 1;
    const alreadyLive = dataRef.current?.accounts.find((account) => account.id === identifier || account.name.toLowerCase() === identifier.toLowerCase());
    if (alreadyLive && liveAccountIds.current.has(alreadyLive.id)) return;

    try {
      const res = await fetch(`/api/new-account?account=${encodeURIComponent(identifier)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.account) throw new Error(json.error ?? "New account unavailable");
      const account = json.account as Account;
      const previous = dataRef.current;
      const existing = previous?.accounts.findIndex((item) => item.id === account.id || item.name.toLowerCase() === account.name.toLowerCase()) ?? -1;
      if (!json.stale || !liveAccountIds.current.has(account.id)) {
        const accounts = previous ? [...previous.accounts] : [];
        if (existing >= 0) accounts[existing] = account;
        else accounts.push(account);
        if (previous) {
          const merged = { ...previous, accounts };
          dataRef.current = merged;
          setData(merged);
        }
      }
      setNewAccountStale(Boolean(json.stale));
      if (!json.stale) {
        setHasEverLiveData(true);
        liveAccountIds.current.add(account.id);
        setFallbackAccountIds((ids) => ids.filter((id) => id !== account.id));
        setLastRefresh(new Date().toLocaleTimeString());
      }
    } catch {
      setNewAccountStale(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const pollSteps = [fetchNewAccount, fetchSignals, fetchWhoAmI, fetchData];
    let nextStep = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!active) return;
        await pollSteps[nextStep % pollSteps.length]();
        nextStep += 1;
        schedule();
      }, 65_000);
    };
    scheduleNextPollRef.current = () => {
      clearTimeout(timer);
      schedule();
    };
    void Promise.resolve().then(fetchData).finally(schedule);
    return () => {
      active = false;
      clearTimeout(timer);
      scheduleNextPollRef.current = null;
    };
  }, [fetchData, fetchNewAccount, fetchSignals, fetchWhoAmI]);

  const refreshAccounts = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    scheduleNextPollRef.current?.();
  }, [fetchData]);

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

  const acct = data.accounts.find((account) => account.id === activeTab) ?? data.accounts[0];
  if (!acct) return null;
  const accountReadout = getAccountReadout(acct);
  const exportDate = new Date(data.exported_at);
  const exportLabel = Number.isNaN(exportDate.getTime()) ? data.exported_at : exportDate.toLocaleString();
  const accountSourceLabel = dataStale
    ? "Saved account snapshot"
    : fallbackAccountIds.length
      ? "MCP export + saved released-account snapshot"
      : "MCP account export";

  return (
    <div className="crm-shell max-w-7xl mx-auto px-4 py-6">
      <header className="fb-nav">
        <a href="#portfolio" className="fb-brand" aria-label="FlytBase customer operations home">
          <Image src="/flytbase-logo-cutout.png" alt="FlytBase" width={210} height={36} className="fb-logo-image" priority />
        </a>
        <nav className="fb-nav-links" aria-label="CRM sections">
          <a href="#portfolio">Portfolio</a>
          <a href="#accounts">Accounts</a>
          <a href="#relationships">Relationships</a>
          <a href="#priorities">Priorities</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <div className="fb-nav-actions">
          <span className={`fb-sync ${dataStale || signalsStale || whoamiStale || newAccountStale || fallbackAccountIds.length ? "is-snapshot" : "is-live"}`} title={lastRefresh ? `Last successful MCP source check: ${lastRefresh}` : "Waiting for the first live sync"}>
            <i />{!hasEverLiveData ? "Saved snapshot" : dataStale || signalsStale || whoamiStale || newAccountStale || fallbackAccountIds.length ? "Partial / last good sync" : "MCP connected"}
          </span>
          <button onClick={refreshAccounts} disabled={refreshing} title="Refresh account data; signals and release checks are polled in turn" className="fb-refresh">
            {refreshing ? "Refreshing…" : "Refresh"} <span aria-hidden="true">›</span>
          </button>
        </div>
      </header>

      <section className="fb-hero" id="portfolio">
        <div className="fb-hero-copyblock">
          <div className="crm-eyebrow"><span className="crm-brand-mark" />Enterprise physical AI platform for drone autonomy</div>
          <h1 className="fb-hero-title">Scale your account program<br />from one account to <em>many</em></h1>
          <p className="fb-hero-copy">One evidence-led view of opportunity value, operating risks and stakeholder sentiment—so the next move is clear even before revenue closes.</p>
          <div className="fb-hero-actions">
            <a href="#accounts" className="fb-button-primary">Review accounts <span aria-hidden="true">›</span></a>
            <a href="#evidence" className="fb-button-secondary"><span aria-hidden="true">↘</span> Trace the evidence</a>
          </div>
        </div>
        <div className="fb-hero-art" aria-label="FlytBase autonomous drone illustration">
          <Image src="/flytbase-drone-cutout.png" alt="Line drawing of an autonomous inspection drone" width={513} height={247} priority />
        </div>
      </section>

      {/* Summary bar */}
      <div className="fb-stats" aria-label="Portfolio summary">
        <div className="fb-stats-intro"><span className="crm-brand-mark" /> Portfolio at a glance</div>
        <div className="fb-stat">
          <div className="text-2xl font-bold text-blue-400">
            {fmt(data.accounts.reduce((s, a) => s + a.opportunities.filter(o => !isOutOfReach(o.stage) && !isAgreed(o.stage)).reduce((ss, o) => ss + (o.worth_up_to ?? 0), 0), 0))}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Potential pipeline</div>
          <div className="metric-source">{data.accounts.flatMap(a => a.opportunities.filter(o => o.worth_up_to != null && !isOutOfReach(o.stage) && !isAgreed(o.stage)).map(o => o.id)).join(" · ")}</div>
        </div>
        <div className="fb-stat">
          <div className="text-2xl font-bold text-green-400">
            {data.accounts.reduce((s, a) => s + a.facts.length, 0)}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Account facts</div>
          <div className="metric-source">{data.accounts.flatMap(a => a.facts.map(f => f.id)).join(" · ")}</div>
        </div>
        <div className="fb-stat">
          <div className="text-2xl font-bold text-yellow-400">
            {data.accounts.reduce((s, a) => s + a.stakeholders.length, 0)}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Key stakeholders</div>
          <div className="metric-source">{data.accounts.flatMap(a => a.stakeholders.map(s => s.id)).join(" · ")}</div>
        </div>
        <div className="fb-stat">
          <div className="text-2xl font-bold text-red-400">
            {data.accounts.reduce((s, a) => s + a.opportunities.filter(o => o.blocker?.status === "open").length, 0)}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Open blockers</div>
          <div className="metric-source">{data.accounts.flatMap(a => a.opportunities.filter(o => o.blocker?.status === "open").map(o => o.id)).join(" · ") || "No open blockers"}</div>
        </div>
      </div>

      {/* Signals */}
      <div id="signals"><SignalsPanel signals={signals} /></div>

      {/* Account tabs */}
      <div id="accounts" className="crm-eyebrow mb-3">Account portfolio</div>
      <div className="flex gap-2 mb-6">
        {data.accounts.map((a, index) => (
          <button key={a.id}
            onClick={() => setActiveTab(a.id)}
            aria-pressed={activeTab === a.id}
            className={`crm-account-tab px-4 py-2 rounded-lg font-semibold text-sm transition ${
              activeTab === a.id
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}>
            <span className="crm-eyebrow mr-2">{String(index + 1).padStart(2, "0")}</span>{a.name}
          </button>
        ))}
      </div>

      {/* Account header */}
      <div id="account" className="crm-card bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="crm-eyebrow mb-2">Selected account · {acct.id === "A" ? "Public safety" : acct.id === "B" ? "Industrial operations" : acct.id === "C" ? "Property operations" : "Customer operations"}</div>
        <h2 className="text-2xl font-medium tracking-tight">{acct.name}</h2>
        <p className="text-sm text-gray-400 mt-1">Account narrative (unverified): {acct.official_story}</p>
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

      <section className="fb-insight" aria-label="Evidence-led account insight">
        <div className="fb-insight-mark" aria-hidden="true">◆</div>
        <div className="fb-insight-content">
          <div className="fb-insight-label">Evidence readout · {acct.name}</div>
          <h2>{accountReadout.title}</h2>
          <p>{accountReadout.text}</p>
          <div className="metric-source">Sources: {accountReadout.source}</div>
        </div>
      </section>

      {/* The 5 Questions */}
      <div className="crm-sections">
        <div className="crm-section-wide" id="book-value"><BookValue acct={acct} /></div>
        <div id="relationships"><PowerMap acct={acct} /></div>
        <div id="priorities"><FirstMoves acct={acct} signals={signals} /></div>
        <Risks acct={acct} signals={signals} />
        <Gaps acct={acct} signals={signals} />
        <div className="crm-section-wide" id="evidence"><FactsTable acct={acct} /></div>
        <NoteWriter key={acct.id} accounts={data.accounts} selectedAccount={acct.id} />
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 mt-8 pb-4">
        FlytBase CRM · {accountSourceLabel} as of {exportLabel} · {data.format}
      </div>
    </div>
  );
}
