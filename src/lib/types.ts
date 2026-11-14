// Types for the CRM data model

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  relationship: "guarded" | "neutral" | "warm" | "ally";
  available: boolean;
}

export interface Fact {
  id: string;
  text: string;
  said_by: string;
  status: "told" | "verified" | "claim";
  verified_by?: string;
  learned_at_minute?: number;
}

export interface Blocker {
  text: string;
  status: "open" | "cleared";
}

export interface Deadline {
  text: string;
  soon: boolean;
  passed: boolean;
  met: boolean;
  moves_left: number | null;
  minutes_left?: number | null;
}

export interface Opportunity {
  id: string;
  title: string;
  stage: string;
  worth_up_to: number | null;
  size: number | null;
  blocker: Blocker | null;
  evidence: string[];
  deadline: Deadline | null;
}

export interface Offer {
  id: string;
  title: string;
  value: number;
  pitch_to: string;
  status: "open" | "won" | "declined";
}

export interface AccountDeadline {
  text: string;
  passed: boolean;
  minutes_left?: number | null;
}

export interface Account {
  id: string;
  name: string;
  official_story: string;
  stakeholders: Stakeholder[];
  facts: Fact[];
  opportunities: Opportunity[];
  offers: Offer[];
  deadlines: AccountDeadline[];
}

export interface FileRef {
  id: string;
  title: string;
  path: string;
  account: string;
}

export interface ExportData {
  format: string;
  player: string;
  exported_at: string;
  minute: number;
  world_closed: boolean;
  accounts: Account[];
  files: FileRef[];
}

export interface Signal {
  id: string;
  account: string;
  date: string;
  title: string;
  body: string;
}
