// Shapes returned by api.pacestreak.com /v1. Kept by hand next to the code
// that renders them; the API is the source of truth.

export type Visibility = "private" | "followers" | "public";

export interface Profile {
  handle: string | null;
  display_name: string | null;
  /** Set only by an admin; the brand's own account. */
  official: boolean;
  bio: string | null;
  avatar_hue: number;
  timezone: string;
  week_starts_on: number;
  weight_unit: "kg" | "lb";
  distance_unit: "km" | "mi";
  training_days: number | null;
  birth_year: number | null;
  onboarded: boolean;
  visibility: Visibility;
  sharing_paused: boolean;
  gamification_enabled: boolean;
  leaderboard_opt_in: boolean;
  social_suspended: boolean;
  deletion_scheduled_at: string | null;
  reminder_hour: number;
  quiet_start: number;
  quiet_end: number;
}

export interface Me {
  user: { id: string; email: string; is_verified: boolean; role: "user" | "moderator" | "admin"; totp_enabled: boolean };
  profile: Profile;
  needs_onboarding: boolean;
  social_allowed: boolean;
  min_age: number;
  social_min_age: number;
  unread_notifications: number;
  follow_requests: number;
  push_public_key: string | null;
}

export interface Discipline {
  id: string;
  name: string;
  emoji: string;
  metrics: string[];
  verb: string;
}

export interface Exercise {
  id: string;
  name: string;
  pattern: string;
  equipment: string;
  primary: string[];
  secondary: string[];
  load_type: "weight" | "bodyweight" | "weighted_bw" | "time";
  rest_sec: number;
  cue: string | null;
  unilateral: boolean;
  aliases: string[];
  custom: boolean;
  archived?: boolean;
}

export interface RoutineItem {
  exercise_id: string;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_sec: number | null;
  target_rpe: number | null;
  note: string | null;
}

export interface Template {
  id: string;
  name: string;
  discipline: string;
  summary: string;
  items: RoutineItem[];
}

export interface Library {
  version: number;
  disciplines: Discipline[];
  muscles: Record<string, string>;
  patterns: Record<string, string>;
  equipment: Record<string, string>;
  exercises: Exercise[];
  templates: Template[];
}

export type SetKind = "work" | "warmup" | "drop" | "failure";

export interface WorkoutSet {
  exercise_id: string;
  position: number;
  set_index: number;
  kind: SetKind;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  completed: boolean;
}

export interface Workout {
  id: string;
  discipline: string;
  title: string | null;
  notes: string | null;
  started_at: string;
  local_date: string;
  duration_sec: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  effort: number | null;
  feel: number | null;
  routine_id: string | null;
  source: string;
  client_updated_at: string;
  deleted_at: string | null;
  seq?: number;
  sets: WorkoutSet[];
  /** Local-only: saved on this device, not yet confirmed by the server. */
  _pending?: boolean;
  _error?: string | null;
}

export interface WeekCell {
  week_start: string;
  days: number;
  target: number;
  status: "kept" | "frozen" | "repaired" | "paused" | "missed" | "open";
  score: number;
}

export interface Chain {
  id: string;
  name: string;
  disciplines: string[];
  target: number;
  current: number;
  longest: number;
  freezes_available: number;
  this_week_days: number;
  this_week_target: number;
  days_left: number;
  needed: number;
  at_risk: boolean;
  will_freeze: boolean;
  repairable_week: string | null;
  run_started: string | null;
  consistency: number;
  /** The current week is sheltered by a pause. */
  paused_now: boolean;
  weeks: WeekCell[];
}

export type PauseReason = "injury" | "illness" | "life" | "other";

export interface Pause {
  id: string;
  starts_on: string;
  /** Inclusive; null while open-ended. */
  ends_on: string | null;
  /** When it actually stops sheltering weeks (open pauses are capped). */
  effective_end: string;
  reason: PauseReason;
  note: string | null;
  active: boolean;
  upcoming: boolean;
}

export interface PauseState {
  pauses: Pause[];
  budget: { days_used: number; days_allowed: number };
}

export interface Recap {
  week_start: string;
  week_end: string;
  status: WeekCell["status"];
  verdict: string;
  days: number;
  target: number;
  sessions: number;
  trained_on: string[];
  disciplines: { id: string; name: string; sessions: number }[];
  previous_days: number | null;
  streak: number;
  longest: number;
  freezes_available: number;
  records: { label: string; day: string }[];
  badges: { id: string; title: string; tier: string | null }[];
  this_week_target: number;
}

export interface FileImportResult {
  format: "gpx" | "fit" | "csv";
  found: number;
  imported: number;
  duplicates: number;
  problems: string[];
  more_problems: number;
}

export interface LevelInfo {
  level: number;
  title: string;
  total_xp: number;
  into_level: number;
  level_span: number;
  to_next: number;
}

export interface HeatDay {
  date: string;
  level: number;
  sessions: number;
  disciplines: string[];
}

export interface Stats {
  today: string;
  week_starts_on: number;
  gamification_enabled: boolean;
  level: LevelInfo;
  xp: { total: number; season: number; by_source: Record<string, number> };
  season: { id: string; starts_on: string; ends_on: string };
  chains: Chain[];
  repair_available: boolean;
  paused_today: boolean;
  pauses: Pause[];
  training_days: number | null;
  heatmap: HeatDay[];
  totals: {
    sessions: number;
    active_days: number;
    hours: number;
    distance_km: number;
    tonnage_kg: number;
    records: number;
    disciplines: number;
    exercises: number;
  };
  last_active: string | null;
}

export interface Badge {
  id: string;
  title: string;
  tier: "bronze" | "silver" | "gold" | null;
  tier_name: string | null;
  hidden: boolean;
  description: string;
}

export interface NewRecord {
  key: string;
  label: string;
  value: number;
  previous: number;
  gain_pct: number;
}

export interface Outcome {
  level: number;
  title: string;
  total_xp: number;
  xp_gained: number;
  leveled_up_to: number | null;
  new_achievements: Badge[];
  new_records: NewRecord[];
  streak: { current: number; this_week_days: number; target: number; milestone: number | null };
}

export interface Person {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_hue: number;
  visibility: Visibility;
  official?: boolean;
  level?: number;
  current_streak?: number;
  [extra: string]: unknown;
}

export interface FeedEvent {
  id: string;
  kind: "workout" | "pr" | "streak" | "achievement" | "level" | "challenge";
  data: Record<string, unknown>;
  date: string;
  created_at: string;
  author: Person;
  kudos: number;
  comments: number;
  kudoed: boolean;
  mine: boolean;
  kudos_by?: Person[];
}

export interface Notification {
  id: string;
  kind: string;
  category: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
  actor: { handle: string | null; display_name: string | null; avatar_hue: number } | null;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  kind: "crew" | "coaching";
  avatar_hue: number;
  member_count: number;
  my_role: "owner" | "admin" | "coach" | "member" | null;
  shares_with_coach: boolean;
  /** Push and email off for this group; the inbox still gets everything. */
  muted?: boolean;
  invite_code: string | null;
  members?: (Person & {
    role: string;
    this_week_days: number;
    this_week_target: number | null;
    consistency: number;
    last_active: string | null;
    shares_with_coach: boolean | null;
  })[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  kind: "active_days" | "weekly_target";
  target: number | null;
  disciplines: string[];
  starts_on: string;
  ends_on: string;
  group_id: string | null;
  status: "upcoming" | "live" | "finished";
  joined: boolean;
  is_creator: boolean;
  invite_code: string | null;
  participants: number | null;
  leaderboard?: (Person & { score: number; rank: number; completed: boolean })[];
  days_total?: number;
  days_elapsed?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  hidden: boolean;
  secret: boolean;
  tiered: boolean;
  unit: string;
  thresholds: number[];
  tier_names: string[];
  unlocked: Record<string, string>;
  progress: { value: number; next: number | null; max: number } | null;
  rarity: Record<string, number>;
}

export interface RecordRow {
  key: string;
  kind: string;
  subject: string;
  label: string;
  value: number;
  previous: number | null;
  gain_pct: number | null;
  date: string;
  workout_id: string | null;
  flagged: boolean;
  rewarded: boolean;
}

export interface BodyMetric {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  resting_hr: number | null;
  sleep_hours: number | null;
  note?: string | null;
}

export interface Routine {
  id: string;
  name: string;
  discipline: string;
  notes: string | null;
  items: RoutineItem[];
  position: number;
  last_used_at: string | null;
  updated_at: string | null;
}
