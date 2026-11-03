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
  skills: Array<{ skill: Skill; experienceYears: number | null; summary: string }>;
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
