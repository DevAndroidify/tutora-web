import { ApiError } from '@tutora/api-client';
import { Spinner } from '@tutora/ui';
import type { ReactNode } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { useSession } from './react';

/** Maps backend error codes to what a person should read. */
export function describeAuthError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return 'Email or password is incorrect.';
    case 'RATE_LIMITED': {
      const s = Number(err.details.retryAfterSeconds ?? 0);
      return `Too many attempts. Try again in ${s > 60 ? `${Math.ceil(s / 60)} minutes` : `${s || 60} seconds`}.`;
    }
    case 'ACCOUNT_SUSPENDED':
      return 'This account is suspended. Check your email or contact support.';
    case 'ACCOUNT_BANNED':
      return 'This account has been banned.';
    case 'EMAIL_TAKEN':
      return 'An account with this email already exists. Sign in instead; the same account works for learning and teaching.';
    case 'NETWORK_ERROR':
      return err.message;
    default:
      return err.requestId ? `${err.message} (reference ${err.requestId})` : err.message;
  }
}

/** Puts backend VALIDATION_FAILED field errors onto the matching form inputs. Returns true if any matched. */
export function applyFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: Array<Path<T>>,
): boolean {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return false;
  let matched = false;
  for (const [name, messages] of Object.entries(err.fieldErrors)) {
    if ((fields as string[]).includes(name)) {
      setError(name as Path<T>, { message: messages[0] });
      matched = true;
    }
  }
  return matched;
}

/** Shows children only when signed in; otherwise renders `signedOut` (usually a redirect to /login). */
export function RequireSession({
  children,
  signedOut,
}: {
  children: ReactNode;
  signedOut: ReactNode;
}) {
  const session = useSession();
  if (session.status === 'loading') {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Checking your session" />
      </div>
    );
  }
  return <>{session.status === 'signedIn' ? children : signedOut}</>;
}
