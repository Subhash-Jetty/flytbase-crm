import type { Account, Opportunity, Signal } from "./types";
import { isAgreed, isOutOfReach, normalizeDealStage } from "./deal-stages";

function dealValueLabel(opportunity: Opportunity | undefined): string {
  return opportunity?.worth_up_to == null
    ? "value not established"
    : `$${opportunity.worth_up_to.toLocaleString()}`;
}

function deadlineMoveLabel(movesLeft: number | null): string {
  return movesLeft == null ? "Deadline is soon; exact move count unavailable" : `${movesLeft} moves left`;
}

function readoutFacts(acct: Account, factIds: string[]) {
  const factsById = new Map(acct.facts.map((fact) => [fact.id, fact]));
  return {
    text: factIds.map((id) => factsById.get(id)?.text ?? `Fact ${id} is missing from the current export.`).join(" "),
    source: factIds.filter((id) => factsById.has(id)).join(" · ") || "No requested fact IDs are present in the current export",
  };
}

// Curated, scenario-specific analysis for the currently released Questathon accounts.
// Recommendations are rules backed by the current export and live signals, not an AI scoring model.

export function analyzeAccount(acct: Account) {
  const totalOpportunityCeiling = acct.opportunities
    .reduce((sum, opportunity) => sum + (opportunity.worth_up_to ?? 0), 0);
  const outOfReachValue = acct.opportunities
    .filter((opportunity) => isOutOfReach(opportunity.stage))
    .reduce((sum, opportunity) => sum + (opportunity.worth_up_to ?? 0), 0);
  const agreedDealValue = acct.opportunities
    .filter((opportunity) => isAgreed(opportunity.stage))
    .reduce((sum, opportunity) => sum + (opportunity.worth_up_to ?? 0), 0);
  const totalPipeline = totalOpportunityCeiling - outOfReachValue - agreedDealValue;
  const wonOffers = acct.offers.filter((offer) => offer.status === "won").reduce((sum, offer) => sum + offer.value, 0);
  const openOffers = acct.offers.filter((offer) => offer.status === "open").reduce((sum, offer) => sum + offer.value, 0);
  return { totalPipeline, totalOpportunityCeiling, outOfReachValue, agreedDealValue, wonOffers, openOffers };
}

export interface FirstMove {
  action: string;
  owner: string;
  deal: string;
  urgency: string;
  due: string;
  evidence: string;
  rank?: number;
}

function signalText(signal: Signal) {
  const parts = [signal.title, signal.body ?? ""];
  try {
    const details = JSON.parse(signal.body ?? "") as { summary?: string; records?: { text?: string; path?: string }[] };
    if (details.summary) parts.push(details.summary);
    for (const record of details.records ?? []) {
      if (record.text) parts.push(record.text);
      if (record.path) parts.push(record.path);
    }
  } catch { /* Keep a plain-text signal readable. */ }
  return parts.join(" ");
}

function signalSummary(signal: Signal) {
  try {
    const details = JSON.parse(signal.body ?? "") as { summary?: string };
    return details.summary ?? signal.body ?? signal.title;
  } catch {
    return signal.body ?? signal.title;
  }
}

export function getFirstMoves(acct: Account, signals: Signal[] = []): FirstMove[] {
  const moves: FirstMove[] = [];

  if (acct.id === "A") {
    const eventRequest = signals.find((signal) => signal.account === "A" && signal.id === "urgent_request");
    if (eventRequest) {
      const text = signalText(eventRequest);
      const ticket = text.match(/\bFB-\d+\b/)?.[0];
      const event = text.match(/public event on ([^.,\n]+)/i)?.[1];
      moves.push({
        action: "Reply to Karen's request with operator training dates and the day-of contact if a dock fails",
        owner: "You → Insp. Karen Mbeki",
        deal: "Westmere event readiness",
        urgency: event ? `Before the public event on ${event}` : "Urgent customer request",
        due: event ? `This week; before the public event on ${event}` : "This week; the signal is marked urgent",
        evidence: [eventRequest.id, ticket].filter(Boolean).join(" · "),
        rank: 1,
      });
    }

    // Recommendations are curated for this quest and ranked by known move deadlines.
    const westmereDeal = acct.opportunities.find((opportunity) => opportunity.id === "a_westmere");
    if (westmereDeal?.blocker?.status === "open" && westmereDeal.deadline && !westmereDeal.deadline.passed) {
      moves.push({
        action: "Build the cost-per-flight comparison, including operator overtime, and send it to Ewan Brooks",
        owner: "You → Ewan Brooks",
        deal: `Scale Westmere's fleet (${dealValueLabel(westmereDeal)})`,
        urgency: `${deadlineMoveLabel(westmereDeal.deadline.moves_left)} — finance bid window closing`,
        due: westmereDeal.deadline.moves_left == null ? "Before the finance window closes; exact move count unavailable" : `Within ${westmereDeal.deadline.moves_left} moves; calendar date not supplied`,
        evidence: "a_westmere · eb_window_2 · eb_drone_2 · km_staff_2",
        rank: westmereDeal.deadline.moves_left ?? 50,
      });
    }

    const tenderDeal = acct.opportunities.find((opportunity) => opportunity.id === "a_tender");
    if (tenderDeal?.blocker?.status === "open" && tenderDeal.deadline && !tenderDeal.deadline.passed) {
      moves.push({
        action: "Submit a written clarification asking procurement to add a costed operating model to the specification",
        owner: "You → Hannah Doyle",
        deal: `300-dock framework tender (${dealValueLabel(tenderDeal)})`,
        urgency: `${deadlineMoveLabel(tenderDeal.deadline.moves_left)} before the specification locks`,
        due: tenderDeal.deadline.moves_left == null ? "Before the specification locks; exact move count unavailable" : `Within ${tenderDeal.deadline.moves_left} moves; calendar date not supplied`,
        evidence: "a_tender · rc_tender_2 · hd_window_2 · hd_weights_1",
        rank: tenderDeal.deadline.moves_left ?? 50,
      });
    }

    const tarnDeal = acct.opportunities.find((opportunity) => opportunity.id === "a_tarn");
    if (tarnDeal?.blocker?.status === "open" && !isOutOfReach(tarnDeal.stage)) {
      moves.push({
        action: "Escalate the overdue data-flow request internally and get the retention, storage and access-control pack to Fatima Osei",
        owner: "You → Pranjal Suyal / SRV",
        deal: `Tarn Valley & Norwold go live (${dealValueLabel(tarnDeal)})`,
        urgency: "Four months overdue; blocks two forces",
        due: "Overdue; no calendar delivery date is supplied",
        evidence: "a_tarn · fo_dpia_2 · fo_needs_3",
        rank: 100,
      });
    }

    const succession = signals.find((signal) => signal.account === "A" && signal.id === "champion_leaves");
    if (succession) {
      moves.push({
        action: "Agree a transition meeting with Rhys and document the programme handover and successor",
        owner: "You → Rhys Calder",
        deal: "Alliance continuity",
        urgency: "Before the January handover",
        due: "Before January; exact date and successor are not supplied",
        evidence: succession.id,
        rank: 110,
      });
    }
  } else if (acct.id === "B") {
    // Aldermoor's next steps depend on Nadia's finance review and the deputy's undocumented rollout knowledge.
    const sisterDeal = acct.opportunities.find((opportunity) => opportunity.id === "b_sister");
    const renewalDeal = acct.opportunities.find((opportunity) => opportunity.id === "b_renewal");
    if (sisterDeal?.blocker?.status === "open" || renewalDeal?.blocker?.status === "open") {
      moves.push({
        action: "Introduce yourself to Nadia Rahman and ask what evidence finance will accept for the renewal and sister-company case",
        owner: "You → Nadia Rahman",
        deal: `Aldermoor renewal (${dealValueLabel(renewalDeal)}) · 40-plant sister-company case study (${dealValueLabel(sisterDeal)})`,
        urgency: "First step for two finance-blocked deals",
        due: "Next account move; no calendar date supplied",
        evidence: "b_renewal · b_sister · sr_roi_2 · jt_prem_2",
        rank: 2,
      });
    }

    const insuranceDeal = acct.opportunities.find((opportunity) => opportunity.id === "b_insurance");
    if (insuranceDeal && normalizeDealStage(insuranceDeal.stage) === "identified") {
      moves.push({
        action: "Ask Julian Tate and Nadia Rahman what is blocking the insurance discount extension",
        owner: "You → Julian Tate + Nadia Rahman",
        deal: "Protect and extend the insurance discount",
        urgency: "Blocker not yet known",
        due: "Next account move; no calendar date supplied",
        evidence: "b_insurance · jt_prem_2",
        rank: 3,
      });
    }

    if (sisterDeal?.blocker?.status === "open") {
      moves.push({
        action: "Prepare a finance-ready case study that separates the unbooked €1.2M estimate from the reported €180K insurance reduction",
        owner: "You → Nadia Rahman, with Stefan Roy",
        deal: `40-plant sister-company case study (${dealValueLabel(sisterDeal)})`,
        urgency: "After Nadia confirms which evidence finance accepts",
        due: "After Nadia confirms acceptable evidence; before sharing the case study",
        evidence: "b_sister · sr_roi_2 · jt_prem_2",
        rank: 4,
      });
    }

    const idleDeal = acct.opportunities.find((opportunity) => opportunity.id === "b_idle");
    if (idleDeal?.deadline && !idleDeal.deadline.passed) {
      moves.push({
        action: "Capture the deputy's rollout steps, network dependencies and plant adoption checklist before he leaves",
        owner: "You → Stefan Roy and his deputy",
        deal: "Aldermoor plant adoption / rollout readiness",
        urgency: "Before the deputy leaves",
        due: "Before departure; exact date not supplied",
        evidence: "b_idle · sr_repl_2 · ba_deputy_0",
        rank: 1,
      });
    }
  } else if (acct.id === "C") {
    const goLive = acct.opportunities.find((opportunity) => opportunity.id === "k_golive_1u9");
    const planDeadline = acct.deadlines.find((deadline) => deadline.text.toLowerCase().includes("go-live plan"));
    const boardDeadline = acct.deadlines.find((deadline) => deadline.text.toLowerCase().includes("board meeting"));
    const planMinute = planDeadline?.minutes_left;
    const boardMinute = boardDeadline?.minutes_left;

    if (goLive?.blocker?.status === "open") {
      moves.push({
        action: "Find a certified pilot and book a supervised commissioning flight with Dana and FlytBase support",
        owner: "You → Dana Whitfield + internal deployment/support owner",
        deal: `North-entrance night-patrol go-live (${dealValueLabel(goLive)})`,
        urgency: planMinute != null ? `Go-live plan due in ${planMinute.toLocaleString()} minutes` : "Dock has never been commissioned",
        due: planMinute != null ? `Within ${planMinute.toLocaleString()} minutes` : "Before go-live; no current deadline supplied",
        evidence: "k_not_commissioned_1u9 · k_no_pilot_1u9 · k_installer_gone_1u9 · K_install_note_1u9",
        rank: 1,
      });
      moves.push({
        action: "Notify the insurer through Lucy and get written confirmation before the first flight",
        owner: "You → Lucy Pratt",
        deal: `North-entrance night-patrol go-live (${dealValueLabel(goLive)})`,
        urgency: "Required before any use under the policy",
        due: planMinute != null ? `Before the first flight; include in the plan due in ${planMinute.toLocaleString()} minutes` : "Before the first flight; include in the promised go-live plan",
        evidence: "k_insurer_not_told_1u9 · K_insurance_schedule_1u9",
        rank: 2,
      });
      moves.push({
        action: "Give Dana a north-gate night-patrol plan with the pilot, commissioning, insurer notice and support owner named",
        owner: "You → Dana Whitfield",
        deal: `North-entrance night-patrol go-live (${dealValueLabel(goLive)})`,
        urgency: planMinute != null ? `Promised plan due in ${planMinute.toLocaleString()} minutes` : "A go-live plan is already promised",
        due: planMinute != null ? `Within ${planMinute.toLocaleString()} minutes` : "Use the promised go-live date; not supplied here",
        evidence: "k_need_entrances_1u9 · k_not_commissioned_1u9 · k_insurer_not_told_1u9",
        rank: 3,
      });
    }

    moves.push({
      action: "Brief Graham on what the board can verify before the security-budget vote",
      owner: "You → Graham Okafor",
      deal: `North-entrance night-patrol go-live (${dealValueLabel(goLive)})`,
      urgency: boardMinute != null ? `Board vote in ${boardMinute.toLocaleString()} minutes` : "Residents already question the unused dock",
      due: boardMinute != null ? `Before the board vote in ${boardMinute.toLocaleString()} minutes` : "Before the next board meeting; date not supplied",
      evidence: "k_board_doubts_1u9 · k_board_pays_1u9 · k_not_commissioned_1u9",
      rank: 4,
    });

    const southDeal = acct.opportunities.find((opportunity) => opportunity.id === "k_south_1u9");
    if (southDeal && normalizeDealStage(southDeal.stage) === "identified") {
      moves.push({
        action: "Keep the second-dock discussion conditional on a north-gate proof point and a south-entrance coverage survey",
        owner: "You → Dana Whitfield",
        deal: "South-entrance second dock (value not established)",
        urgency: "Do not count or price it until need and coverage are validated",
        due: "After the north-gate dock flies; before any second-dock proposal",
        evidence: "k_south_unassessed_1u9 · k_south_wish_1u9",
        rank: 5,
      });
    }
  } else {
    const openDeals = acct.opportunities.filter((opportunity) => !isOutOfReach(opportunity.stage) && normalizeDealStage(opportunity.stage) !== "agreed");
    for (const opportunity of openDeals.slice(0, 3)) {
      const owner = acct.stakeholders.find((stakeholder) => stakeholder.available)?.name ?? "Account owner to confirm";
      const deadline = opportunity.deadline;
      moves.push({
        action: opportunity.blocker?.status === "open"
          ? `Confirm the blocker owner and evidence needed to clear: ${opportunity.blocker.text}`
          : `Confirm the decision path and next milestone for ${opportunity.title}`,
        owner: `You → ${owner}`,
        deal: opportunity.title,
        urgency: deadline?.moves_left != null ? `${deadline.moves_left} account moves remain` : deadline?.minutes_left != null ? `${deadline.minutes_left.toLocaleString()} minutes remain` : "No deadline recorded",
        due: deadline?.moves_left != null ? `Within ${deadline.moves_left} account moves` : deadline?.minutes_left != null ? `Within ${deadline.minutes_left.toLocaleString()} minutes` : "Set a date with the account owner",
        evidence: [opportunity.id, ...opportunity.evidence].join(" · "),
      });
    }
  }

  return moves.sort((first, second) => (first.rank ?? Number.MAX_SAFE_INTEGER) - (second.rank ?? Number.MAX_SAFE_INTEGER));
}

export function getRisks(acct: Account, signals: Signal[] = []): { risk: string; impact: string; deadline: string; source: string }[] {
  const risks: { risk: string; impact: string; deadline: string; source: string }[] = [];

  if (acct.id === "A") {
    const westmere = acct.opportunities.find(o => o.id === "a_westmere");
    if (westmere?.deadline && !westmere.deadline.passed) {
      risks.push({
        risk: "Metro Central finance bid window closing",
        impact: `If the blocker is not cleared, Metro Central cannot enter this finance round with a dock expansion bid. ${dealValueLabel(westmere)} opportunity at risk.`,
        deadline: deadlineMoveLabel(westmere.deadline.moves_left),
        source: "eb_window_2 (Ewan Brooks)",
      });
    }

    const tender = acct.opportunities.find(o => o.id === "a_tender");
    if (tender?.deadline && !tender.deadline.passed) {
      risks.push({
        risk: "Tender spec locks without operating model",
        impact: `40% of bid weighting has no answer. ${dealValueLabel(tender)} deal weakened.`,
        deadline: deadlineMoveLabel(tender.deadline.moves_left),
        source: "rc_tender_2 (Rhys Calder), hd_weights_1 (Hannah Doyle)",
      });
    }

    risks.push({
      risk: "FlytBase silent since pilot — trust eroding",
      impact: "Procurement has had no follow-up since the pilot, and Fatima's requested data-flow pack is four months overdue.",
      deadline: "Immediate",
      source: "hd_silence_3 (Hannah Doyle), fo_dpia_2 (Fatima Osei)",
    });

  } else if (acct.id === "B") {
    risks.push({
      risk: "Stefan's deputy leaving — rollout knowledge unwritten",
      impact: "The rollout template is mostly undocumented; replicating the programme across more plants is at risk.",
      deadline: "Soon — no exact date",
      source: "sr_repl_2 (Stefan Roy), ba_deputy_0 (Beatriz Alonso)",
    });

    risks.push({
      risk: "€1.2M savings estimate is not booked",
      impact: "It is based on a spreadsheet of replaceable guard hours. Finance booked no saving; Neel reports a €180K premium reduction, but the insurer's supporting letter is not in the current export.",
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
  } else if (acct.id === "C") {
    const planDeadline = acct.deadlines.find((deadline) => deadline.text.toLowerCase().includes("go-live plan"));
    const boardDeadline = acct.deadlines.find((deadline) => deadline.text.toLowerCase().includes("board meeting"));
    risks.push({
      risk: "The north-gate dock is not ready to fly",
      impact: "No certified pilot is on site, no commissioning flight was completed, and the installer no longer answers.",
      deadline: planDeadline?.minutes_left != null ? `Go-live plan due in ${planDeadline.minutes_left.toLocaleString()} minutes` : "Go-live plan is promised; current deadline unavailable",
      source: "k_not_commissioned_1u9 · k_no_pilot_1u9 · k_installer_gone_1u9",
    });
    risks.push({
      risk: "The dock has not been declared to the insurer",
      impact: "The policy requires notification of new aerial equipment before use. A flight before confirmation could breach the policy condition.",
      deadline: "Before the first flight",
      source: "k_insurer_not_told_1u9 · K_insurance_schedule_1u9",
    });
    risks.push({
      risk: "The board may renew the security budget before seeing a working dock",
      impact: "Residents already question paying for a dock that has never flown; Graham says extra spend needs a board vote.",
      deadline: boardDeadline?.minutes_left != null ? `Board vote in ${boardDeadline.minutes_left.toLocaleString()} minutes` : "Board vote date unavailable",
      source: "k_board_doubts_1u9 · k_board_pays_1u9",
    });
    risks.push({
      risk: "The sales scope does not match the estate's stated need",
      impact: "Dana wants night patrol at two entrances, while the original pitch was estate-wide mapping. South-entrance coverage is unassessed.",
      deadline: "Before proposing the second dock",
      source: "k_need_entrances_1u9 · k_south_unassessed_1u9 · k_south_wish_1u9",
    });
  } else {
    for (const opportunity of acct.opportunities.filter((item) => normalizeDealStage(item.stage) !== "agreed" && !isOutOfReach(item.stage))) {
      if (opportunity.blocker?.status === "open") {
        risks.push({
          risk: `${opportunity.title}: blocker remains open`,
          impact: opportunity.blocker.text,
          deadline: opportunity.deadline?.moves_left != null ? `${opportunity.deadline.moves_left} account moves remain` : opportunity.deadline?.minutes_left != null ? `${opportunity.deadline.minutes_left.toLocaleString()} minutes remain` : "No deadline recorded",
          source: [opportunity.id, ...opportunity.evidence].join(" · "),
        });
      }
    }
  }
  if (acct.id === "A") {
    const urgentRequest = signals.find((signal) => signal.account === "A" && signal.id === "urgent_request");
    if (urgentRequest) {
      const details = signalText(urgentRequest);
      const event = details.match(/public event on ([^.,\n]+)/i)?.[1];
      const ticket = details.match(/\bFB-\d+\b/)?.[0];
      risks.unshift({
        risk: "Westmere's public-event support request is unanswered",
        impact: signalSummary(urgentRequest),
        deadline: event ? `Before the public event on ${event}` : "Before the event deadline in the signal",
        source: [urgentRequest.id, ticket].filter(Boolean).join(" · "),
      });
    }
    const championLeaves = signals.find((signal) => signal.account === "A" && signal.id === "champion_leaves");
    if (championLeaves) {
      const details = signalSummary(championLeaves);
      risks.unshift({
        risk: "Rhys Calder is leaving without a named successor",
        impact: details,
        deadline: "Before the January handover stated in the signal",
        source: championLeaves.id,
      });
    }
  }

  return risks;
}

export function getGaps(acct: Account, signals: Signal[] = []): { gap: string; why: string; who: string; source: string }[] {
  const gaps: { gap: string; why: string; who: string; source: string }[] = [];

  if (acct.id === "A") {
    gaps.push({
      gap: "Cost per drone flight (staffing included)",
      why: "No comparable drone cost yet: operator overtime is not tracked separately, so it cannot be compared with the £1,500/hr helicopter figure.",
      who: "Ewan Brooks (payroll sign-off) + Karen Mbeki (flight hours)",
      source: "eb_drone_2 · km_staff_2 · eb_heli_1",
    });
    gaps.push({
      gap: "Programme leadership succession and handover",
      why: signals.some((signal) => signal.account === "A" && signal.id === "champion_leaves")
        ? "Rhys says he is leaving in January and no successor has been named; the calls on file were with him alone."
        : "The current account export has no succession or handover detail. Confirm continuity before the next board cycle.",
      who: "Rhys Calder / Alliance board",
      source: signals.some((signal) => signal.account === "A" && signal.id === "champion_leaves") ? "champion_leaves" : "No succession fact ID in current export; confirm with Rhys",
    });
    gaps.push({
      gap: "Norwold chief constable's position on privacy",
      why: "Karen reports the chief is cautious after a local privacy row. His specific conditions and approval position are not in this export.",
      who: "Karen Mbeki → Norwold chief constable",
      source: "km_others_2",
    });
    gaps.push({
      gap: "Who flies 300 docks — staffing model",
      why: "The 30-dock staffing note says 9 more trained operators are needed. The 300-dock tender is 10× larger, but staffing at that scale is not established.",
      who: "Karen Mbeki + operating model in tender spec",
      source: "km_staff_2 · rc_tender_2",
    });
    gaps.push({
      gap: "Unverified stadium project claim — validate before counting it",
      why: "Only a claimed 30-dock Westmere stadium project is recorded. The buyer, budget and operator are unconfirmed, so keep it out of backed pipeline.",
      who: "Rhys Calder (claim owner) + Karen Mbeki (operator) + Ewan Brooks (budget)",
      source: "rc_stadium_0 (claim)",
    });
  } else if (acct.id === "B") {
    gaps.push({
      gap: "Verified savings figure for case study",
      why: "The €1.2M figure is a spreadsheet estimate, not booked savings. Neel reports a €180K annual premium reduction, but the supporting insurer letter is not in the current export; verify its amount and terms with Nadia and Julian.",
      who: "Nadia Rahman (finance) + Julian Tate (insurance)",
      source: "sr_roi_2 · jt_prem_2 (reported by Neel Sharma)",
    });
    gaps.push({
      gap: "Why 9 plants only test-fly",
      why: "The export confirms four plants fly regularly and nine only test-fly. Plant 11 has a reported network and ownership issue; the reason for the other test-only sites is not established.",
      who: "Stefan Roy + managers at the test-only plants; Owen Fitch for Plant 11 network",
      source: "sr_roll_2 · ba_other_1; reasons for the other sites are unknown",
    });
    gaps.push({
      gap: "Guard contractor contract renewal dates",
      why: "Guard contracts don't cover drone alerts. Need to know when they renew to fix the gap",
      who: "Nadia Rahman (finance holds guard contracts)",
      source: "ba_use_2 · no renewal date in current export",
    });
    gaps.push({
      gap: "IT sign-off on dock network installations",
      why: "Group IT was never involved in installs. Potential compliance/security risk",
      who: "Owen Fitch (Group IT)",
      source: "No IT sign-off fact ID in current export; confirm with Owen",
    });
    gaps.push({
      gap: "Why 3 active docks stopped flying in November",
      why: "No outage event details are present in the saved account export. Identify the affected docks and when flights stopped before assigning a cause.",
      who: "Stefan Roy / Plant managers of affected plants",
      source: "Awaiting live signal ID; no outage record in saved account export",
    });
  } else if (acct.id === "C") {
    gaps.push({
      gap: "Certified pilot and commissioning owner",
      why: "No one at the estate is certified, the installer is unreachable, and the dock has never completed a test flight. The internal deployment owner and next available pilot are not named.",
      who: "Dana Whitfield + FlytBase deployment/support owner",
      source: "k_no_pilot_1u9 · k_not_commissioned_1u9 · k_installer_gone_1u9",
    });
    gaps.push({
      gap: "Insurer notice and written acceptance",
      why: "The schedule requires notice before use, but no confirmation from the insurer is recorded.",
      who: "Lucy Pratt → insurer",
      source: "k_insurer_not_told_1u9 · K_insurance_schedule_1u9",
    });
    gaps.push({
      gap: "Board evidence and approval route",
      why: "Extra spend needs a residents' board vote. The agenda, evidence Graham needs, and exact vote date are not in the account export.",
      who: "Graham Okafor",
      source: "k_board_pays_1u9 · k_board_doubts_1u9",
    });
    gaps.push({
      gap: "South-entrance coverage and second-dock value",
      why: "The south entrance has not been assessed; Dana's interest is conditional on the north-gate dock working. No price or qualified opportunity value is established.",
      who: "Dana Whitfield",
      source: "k_south_unassessed_1u9 · k_south_wish_1u9",
    });
  } else {
    for (const opportunity of acct.opportunities.filter((item) => item.blocker?.status === "open").slice(0, 5)) {
      gaps.push({
        gap: `Evidence and approval path for ${opportunity.title}`,
        why: `The record names this blocker but does not establish the full evidence set or the person who can clear it: ${opportunity.blocker?.text}`,
        who: acct.stakeholders.find((stakeholder) => stakeholder.available)?.name ?? "Account decision owner to identify",
        source: [opportunity.id, ...opportunity.evidence].join(" · "),
      });
    }
    if (gaps.length === 0) {
      gaps.push({ gap: "Decision owners and success criteria", why: "No open blocker is recorded. Confirm who signs off and what evidence counts as success before advancing the account.", who: "Available stakeholder to identify", source: "Current account record" });
    }
  }
  return gaps;
}

export function getAccountReadout(acct: Account) {
  if (acct.id === "A") {
    const evidence = readoutFacts(acct, ["km_usage_1", "hd_weights_1", "eb_drone_2", "rc_tender_2"]);
    return {
      title: "Operational use is established; scale economics still need proof.",
      ...evidence,
    };
  }
  if (acct.id === "B") {
    const evidence = readoutFacts(acct, ["sr_roll_2", "sr_roi_2", "jt_prem_2"]);
    return {
      title: "Prove adoption and savings before leading with expansion.",
      ...evidence,
    };
  }
  if (acct.id === "C") {
    const evidence = readoutFacts(acct, ["k_not_commissioned_1u9", "k_no_pilot_1u9", "k_insurer_not_told_1u9", "k_need_entrances_1u9"]);
    return {
      title: "Turn the paid north-gate dock into a compliant, evidenced go-live.",
      ...evidence,
    };
  }
  const openCount = acct.opportunities.filter((opportunity) => opportunity.blocker?.status === "open").length;
  return {
    title: `${acct.name}: ${openCount} open blocker${openCount === 1 ? "" : "s"} need an owner and evidence plan.`,
    text: "This account is new to the dashboard. The live account records are visible below; confirm decision authority, success criteria and the evidence required before quoting outcomes.",
    source: acct.opportunities.map((opportunity) => opportunity.id).join(" · ") || "No opportunity IDs in current record",
  };
}
