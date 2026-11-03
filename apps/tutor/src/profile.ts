import { useQuery } from '@tanstack/react-query';
import { ApiError, unwrap } from '@tutora/api-client';
import type { TutorProfile } from '@tutora/core';
import { api } from './api';

/** The tutor's own profile, or null before it is first created (backend answers 404). */
export function useMyProfile() {
  return useQuery({
    queryKey: ['tutor', 'profile'],
    queryFn: async () => {
      try {
        return await unwrap<TutorProfile>(api.GET('/tutor/profile'));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'TUTOR_PROFILE_NOT_FOUND') return null;
        throw err;
      }
    },
  });
}

/** Steps to verification, in order, for the dashboard checklist. */
export function onboardingSteps(p: TutorProfile | null) {
  return [
    { label: 'Write your profile', done: !!p?.headline && !!p.bio },
    { label: 'Add a payout UPI ID', done: !!p?.payoutUpiId },
    { label: 'List at least one skill with evidence', done: (p?.skills.length ?? 0) > 0 },
    { label: 'Submit for review', done: !!p && p.verificationStatus !== 'NOT_SUBMITTED' },
    { label: 'Get verified', done: p?.verificationStatus === 'VERIFIED' },
  ];
}
