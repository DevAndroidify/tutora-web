import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@tutora/api-client';
import { Alert, Button, Card, Field, Spinner } from '@tutora/ui';
import { useState, type ReactNode } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { signedOutMessage, useSession, useSessionStore } from './react';

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

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({
  title,
  subtitle,
  onSuccess,
  footer,
}: {
  title: string;
  subtitle?: string;
  onSuccess: () => void;
  footer?: ReactNode;
}) {
  const store = useSessionStore();
  const session = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });
  const notice = session.status === 'signedOut' ? signedOutMessage(session.reason) : null;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await store.login(values.email, values.password);
      onSuccess();
    } catch (err) {
      if (!applyFieldErrors(err, setError, ['email', 'password']))
        setFormError(describeAuthError(err));
    }
  });

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {notice && <Alert tone="warning">{notice}</Alert>}
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
    </Card>
  );
}

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(10, 'Use at least 10 characters.').max(128),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  title,
  subtitle,
  onSuccess,
  footer,
}: {
  title: string;
  subtitle?: string;
  onSuccess: () => void;
  footer?: ReactNode;
}) {
  const store = useSessionStore();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await store.register(values);
      onSuccess();
    } catch (err) {
      if (!applyFieldErrors(err, setError, ['fullName', 'email', 'password']))
        setFormError(describeAuthError(err));
    }
  });

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field
          label="Full name"
          autoComplete="name"
          error={formState.errors.fullName?.message}
          {...register('fullName')}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
      {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
    </Card>
  );
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
