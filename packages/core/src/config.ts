/** API origin: empty in development (the Vite dev server proxies the API), set for production builds. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

/** Where each app lives, for the "switch to tutor/student" links. */
export const APP_URLS = {
  student: import.meta.env.VITE_STUDENT_APP_URL ?? 'http://localhost:5173',
  tutor: import.meta.env.VITE_TUTOR_APP_URL ?? 'http://localhost:5174',
  admin: import.meta.env.VITE_ADMIN_APP_URL ?? 'http://localhost:5175',
} as const;
