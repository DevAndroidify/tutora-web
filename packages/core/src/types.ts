/**
 * Response shapes from the backend. The OpenAPI documents describe request bodies
 * but not responses, so these mirror the backend view types (checked against a live API).
 */

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  children?: Category[];
}

export interface Skill {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  learnerNotice: string | null;
  isActive: boolean;
}

export interface Topic {
  id: string;
  skillId: string;
  slug: string;
  name: string;
  isActive: boolean;
}

export interface SkillDetail extends Skill {
  category: Category;
  topics: Topic[];
}

export type Badge = 'NONE' | 'VERIFIED' | 'EXPERT';
export type VerificationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PublicTutor {
  userId: string;
  fullName: string;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  languages: string[];
  badge: Badge;
  skills: Array<{
    skill: Skill;
    experienceYears: number | null;
    summary: string;
    mastery?: { skillId: string; score: number | null; label: string; attempts: number };
  }>;
  rating?: { average: number | null; count: number };
}

export interface TutorSkillClaim {
  skill: Skill;
  status: ReviewStatus;
  experienceYears: number | null;
  summary: string;
  evidenceLinks: string[];
  rejectionReason: string | null;
  decidedAt: string | null;
}

export interface TutorProfile {
  userId: string;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  languages: string[];
  badge: Badge;
  verificationStatus: VerificationStatus;
  payoutUpiId: string | null;
  verificationSubmittedAt: string | null;
  verificationDecidedAt: string | null;
  verificationRejectionReason: string | null;
  skills: TutorSkillClaim[];
}

export interface ProfileReview extends TutorProfile {
  fullName: string;
  email: string;
}

export interface SkillReview extends TutorSkillClaim {
  tutorUserId: string;
  tutorName: string;
  tutorVerificationStatus: VerificationStatus;
}

export interface SkillSuggestion {
  id: string;
  suggestedBy: string;
  categoryId: string;
  name: string;
  description: string | null;
  status: ReviewStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  createdSkillId: string | null;
  createdAt: string;
}

export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type RequestStatus =
  'DRAFT' | 'OPEN' | 'POOLED' | 'RESERVED' | 'BOOKED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Short-lived read URL. */
  url: string;
}

export interface LearningRequest {
  id: string;
  skill: { id: string; slug: string; name: string; learnerNotice: string | null };
  topicId: string | null;
  level: Level;
  title: string;
  description: string;
  preferredLanguage: string | null;
  budgetHintPaise: number | null;
  currency: string;
  status: RequestStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  attachments: Attachment[];
}

export interface Presign {
  objectKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export const REPORT_REASONS = {
  HARASSMENT: 'Harassment or abuse',
  OFF_PLATFORM_PAYMENT: 'Asked to pay outside Tutora',
  NO_SHOW: 'Did not show up',
  MISLEADING_CLAIMS: 'Misleading claims or credentials',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  FINANCIAL_TIPS: 'Gave stock tips or investment advice',
  SPAM: 'Spam',
  OTHER: 'Something else',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export type ReportEntityType =
  'USER' | 'TUTOR_PROFILE' | 'TUTOR_SKILL' | 'LEARNING_REQUEST' | 'BID' | 'SESSION';

export type CaseStatus = 'OPEN' | 'ACTIONED' | 'DISMISSED';
export type CaseAction =
  'DISMISS' | 'WARN' | 'RESTRICT_POSTING' | 'RESTRICT_BIDDING' | 'SUSPEND' | 'BAN';

export interface CaseSummary {
  id: string;
  subjectUserId: string;
  subjectName: string;
  status: CaseStatus;
  priority: number;
  assignedTo: string | null;
  openedAt: string;
  lastActivityAt: string;
  reportCount: number;
  flagCount: number;
}

export interface Sanction {
  id: string;
  type: Exclude<CaseAction, 'DISMISS'>;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  liftedAt: string | null;
  caseId: string | null;
}

export interface CaseDetail {
  case: {
    id: string;
    status: CaseStatus;
    priority: number;
    assignedTo: string | null;
    resolution: string | null;
    openedAt: string;
    closedAt: string | null;
  };
  subject: { id: string; fullName: string; email: string; status: string };
  history: { strikes: number; dismissed: number };
  reports: Array<{
    id: string;
    reporterUserId: string;
    reason: ReportReason;
    entityType: ReportEntityType | null;
    entityId: string | null;
    details: string | null;
    reportedFromApp: string;
    createdAt: string;
  }>;
  flags: Array<{
    id: string;
    entityType: string;
    entityId: string;
    field: string;
    rule: string;
    severity: string;
    action: string;
    excerpt: string | null;
    createdAt: string;
  }>;
  actions: Array<{
    id: string;
    actorUserId: string;
    action: CaseAction;
    reason: string;
    durationDays: number | null;
    createdAt: string;
  }>;
  sanctions: Sanction[];
}

// ---------- marketplace and bids ----------

export type BidStatus = 'SUBMITTED' | 'ACCEPTED' | 'HELD' | 'WITHDRAWN' | 'EXPIRED' | 'REJECTED';

export interface Bid {
  id: string;
  requestId: string;
  seatPricePaise: number;
  currency: string;
  proposedStartAt: string;
  durationMinutes: number;
  approachText: string | null;
  hasApproachMedia: boolean;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
}

/** A request as an eligible tutor sees it: learner shown by first name + initial, bids by count only. */
export interface MarketRequest extends LearningRequest {
  studentDisplayName: string;
  bidCount: number;
  myBid?: Bid | null;
}

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  value: number;
  placeholder: boolean;
  note: string | null;
}

/** A bid as the learner who owns the request sees it, with the ranking explained. */
export interface RankedBid extends Bid {
  tutor: { userId: string; badge: Badge; headline: string | null; fullName: string };
  approachMediaUrl: string | null;
  score: { total: number; components: ScoreComponent[] };
}

// ---------- bookings, payments, sessions ----------

export type SessionStatus =
  'PENDING_PAYMENT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

/** One seat in a session (from /student/sessions, /tutor/sessions and bid acceptance). */
export interface SessionSeat {
  sessionId: string;
  participantId: string;
  requestId: string;
  bidId: string;
  tutorUserId: string;
  sessionStatus: SessionStatus | string;
  participantStatus: string;
  startsAt: string;
  durationMinutes: number;
  amountPaise: number;
  currency: string;
  paymentDueAt: string | null;
}

export type Checkout =
  | {
      provider: 'fake';
      simulatePaymentUrl: string;
      orderId: string;
      amount: number;
      currency: 'INR';
    }
  | {
      provider: 'razorpay';
      keyId: string;
      checkoutOptions?: Record<string, unknown>;
      orderId: string;
      amount: number;
      currency: 'INR';
    };

export interface Payment {
  id: string;
  participantId: string;
  provider: 'fake' | 'razorpay';
  status: 'INITIATED' | 'HELD' | 'FAILED' | 'RELEASED' | 'REFUNDED' | string;
  amountPaise: number;
  currency: string;
  providerOrderId: string;
  failureReason: string | null;
  refundReason: string | null;
  createdAt: string;
  checkout?: Checkout;
}

export interface JoinToken {
  token: string;
  /** LiveKit websocket URL. */
  url: string;
  room: string;
  identity: string;
  expiresAt: string;
}

export interface RecordingView {
  sessionId: string;
  status: 'NOT_RECORDED' | 'RECORDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED' | string;
  consents: Array<{ userId: string; role: 'TUTOR' | 'STUDENT'; granted: boolean | null }>;
  url: string | null;
  deleteAfter: string | null;
}

export interface AttendanceRow {
  identity: string;
  role: 'TUTOR' | 'STUDENT';
  userId: string;
  firstJoinedAt: string;
  seconds: number;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  speaker: string | null;
  text: string;
}

export interface ReplayAsset<T> {
  status: string;
  source: 'TUTOR' | 'GENERATED';
  provider: string | null;
  model: string | null;
  content: T;
}

export interface Replay {
  sessionId: string;
  recording: RecordingView;
  transcript: { status: string; segments: TranscriptSegment[] };
  notes: ReplayAsset<{ summary: string; keyPoints: Array<{ text: string; atMs: number }> }> | null;
  flashcards: ReplayAsset<{ cards: Array<{ front: string; back: string; atMs: number }> }> | null;
  whiteboard: Array<{ id?: string; url?: string | null; createdAt?: string }>;
}

export interface ReplaySearch {
  sessionId: string;
  q: string;
  /** `snippet` marks matches with [[ ]]. */
  results: Array<TranscriptSegment & { snippet?: string }>;
}

export interface Quiz {
  id: string;
  sessionId: string;
  kind: string;
  mode: string;
  status: 'OPEN' | 'SUBMITTED' | 'EXPIRED' | string;
  availableAt: string;
  dueAt: string;
  questions: Array<{ id: string; prompt: string; options: string[] }>;
  result: { correct: number; total: number; passed: boolean } | null;
}

export const DISPUTE_REASONS = {
  TUTOR_ABSENT_OR_LATE: 'Tutor was absent or very late',
  POOR_QUALITY: 'Poor quality',
  NOT_AS_DESCRIBED: 'Not what the bid described',
  TECHNICAL_ISSUES: 'Technical problems',
  MISCONDUCT: 'Misconduct',
  OTHER: 'Something else',
} as const;
export type DisputeReason = keyof typeof DISPUTE_REASONS;

export interface Dispute {
  id: string;
  sessionId: string;
  reason: DisputeReason;
  details: string | null;
  status: string;
  resolutionNote: string | null;
  openedAt: string;
  resolvedAt: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string | undefined>;
  readAt: string | null;
  createdAt: string;
}

export type LiveMode = 'FULL_VIDEO' | 'AUDIO_ONLY' | 'WHITEBOARD_ONLY';

// ---------- money (phase 12) ----------

export type PaymentStatus =
  'INITIATED' | 'VERIFIED' | 'HELD' | 'RELEASED' | 'REFUNDED' | 'FROZEN' | 'FAILED';

/** GET /tutor/earnings. availablePaise is after the platform fee; the gross figures are before it. */
export interface Earnings {
  currency: 'INR';
  availablePaise: number;
  pendingGrossPaise: number;
  releasedGrossPaise: number;
  platformFeeBps: number;
  payouts: Payout[];
}

export interface Payout {
  id: string;
  amountPaise: number;
  reference: string;
  createdAt: string;
}

export type DisputeStatus = 'OPEN' | 'RESOLVED_RELEASE' | 'RESOLVED_REFUND';

/** A dispute as staff see it. */
export interface AdminDispute extends Dispute {
  participantId: string;
  paymentId: string;
  studentUserId: string;
  tutorUserId: string;
  status: DisputeStatus;
}

export interface LedgerBalance {
  code: string;
  type: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE' | string;
  debitsPaise: number;
  creditsPaise: number;
  balancePaise: number;
}

export interface LedgerCheck {
  totalDebitsPaise: number;
  totalCreditsPaise: number;
  balanced: boolean;
  unbalancedTransactions: number[];
  transactionCount: number;
}

export interface Reconciliation {
  ok: boolean;
  ledger: LedgerCheck;
  heldFundsPaise: number;
  paymentsChecked: number;
  providerChecked: number;
  mismatches: Array<{ paymentId?: string; check: string; expected: unknown; actual: unknown }>;
}

export interface LowBandwidthMetrics {
  from: string;
  to: string;
  sessionsReporting: number;
  lowBandwidthSessions: number;
  /** 0..1 */
  lowBandwidthShare: number;
  avgDownlinkKbps: number | null;
  byMode: Array<{ mode: LiveMode; events: number; sessions: number }>;
}

// ---------- group sessions (phase 13) ----------

export type PoolStatus =
  'FORMING' | 'BIDDING' | 'AWAITING_PAYMENTS' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

/** GET /student/pools/invites. Other learners stay anonymous: only counts are shown. */
export interface PoolInvite {
  id: string;
  status: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  requestId: string;
  expiresAt: string;
  matchedBy: string;
  similarity: number | null;
  pool: {
    id: string;
    status: PoolStatus;
    skill: { id: string; name: string };
    level: Level;
    seatCap: number;
    joined: number;
    invited: number;
  };
}

export interface PoolBid extends RankedBid {
  minSeats: number | null;
  maxSeats: number | null;
}

export interface PoolOffers {
  poolId: string;
  status: PoolStatus;
  acceptedBidId: string | null;
  bids: PoolBid[];
}

/** POST /student/pools/{id}/bids/{bidId}/accept: your own seat in the group session, to pay for. */
export interface PoolSeat {
  poolId: string;
  sessionId: string;
  participantId: string;
  amountPaise: number;
  currency: 'INR';
  minSeats: number;
  maxSeats: number;
  paymentDueAt: string;
}

/** GET /tutor/pools: groups a verified tutor can bid on. */
export interface OpenPool {
  id: string;
  skillId: string;
  level: Level;
  status: PoolStatus;
  members: number;
  seatCap: number;
}
