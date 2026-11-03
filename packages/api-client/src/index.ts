export { ApiError, toApiError, isApiErrorBody, type ApiErrorBody } from './errors';
export {
  authFetch,
  createApiClient,
  unwrap,
  type ApiClientOptions,
  type AuthHooks,
} from './client';
export type { paths as StudentPaths, components as StudentComponents } from './generated/student';
export type { paths as TutorPaths, components as TutorComponents } from './generated/tutor';
export type { paths as AdminPaths, components as AdminComponents } from './generated/admin';
export type { paths as PublicPaths, components as PublicComponents } from './generated/public';

/** Idempotency key for one user intent (reuse it when retrying the same action). */
export function newIdempotencyKey(prefix = 'web'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
