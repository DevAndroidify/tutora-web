import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import type {
  CaseStatus,
  CaseSummary,
  Category,
  ProfileReview,
  ReviewStatus,
  SkillReview,
  SkillSuggestion,
  VerificationStatus,
} from '@tutora/core';
import { api } from './api';

export const keys = {
  profiles: (status: VerificationStatus) => ['admin', 'profile-reviews', status] as const,
  skills: (status: ReviewStatus) => ['admin', 'skill-reviews', status] as const,
  suggestions: (status: ReviewStatus) => ['admin', 'suggestions', status] as const,
  cases: (status: CaseStatus) => ['admin', 'cases', status] as const,
  categories: ['admin', 'categories'] as const,
};

export const useProfileReviews = (status: VerificationStatus) =>
  useQuery({
    queryKey: keys.profiles(status),
    queryFn: () =>
      unwrap<ProfileReview[]>(
        api.GET('/admin/tutors/profile-reviews', { params: { query: { status } } }),
      ),
  });

export const useSkillReviews = (status: ReviewStatus) =>
  useQuery({
    queryKey: keys.skills(status),
    queryFn: () =>
      unwrap<SkillReview[]>(
        api.GET('/admin/tutors/skill-reviews', { params: { query: { status } } }),
      ),
  });

export const useSuggestions = (status: ReviewStatus) =>
  useQuery({
    queryKey: keys.suggestions(status),
    queryFn: () =>
      unwrap<SkillSuggestion[]>(
        api.GET('/admin/catalog/skill-suggestions', { params: { query: { status } } }),
      ),
  });

export const useCases = (status: CaseStatus) =>
  useQuery({
    queryKey: keys.cases(status),
    queryFn: () =>
      unwrap<CaseSummary[]>(api.GET('/admin/moderation/cases', { params: { query: { status } } })),
  });

/** Admin categories come back flat (including inactive ones). */
export const useAdminCategories = () =>
  useQuery({
    queryKey: keys.categories,
    queryFn: () => unwrap<Category[]>(api.GET('/admin/catalog/categories')),
  });
