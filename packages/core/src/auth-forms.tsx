import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Field } from '@tutora/ui';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
// zod/mini: same validation, a fraction of the bundle size of the classic API.
import { z } from 'zod/mini';
import { applyFieldErrors, describeAuthError } from './auth-ui';
import { signedOutMessage, useSession, useSessionStore } from './react';

/** Sign-in and registration forms. Loaded only on /login and /register (own chunk). */
const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().check(z.minLength(1, 'Enter your password.')),
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
    <Card className="mx-auto w-full max-w-md border-t-8 border-t-brand p-8">
      <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
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
  fullName: z.string().check(z.trim(), z.minLength(1, 'Enter your name.'), z.maxLength(120)),
  email: z.email('Enter a valid email address.'),
  password: z.string().check(z.minLength(10, 'Use at least 10 characters.'), z.maxLength(128)),
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
    <Card className="mx-auto w-full max-w-md border-t-8 border-t-brand p-8">
      <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
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
