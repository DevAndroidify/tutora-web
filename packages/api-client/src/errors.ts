/** The backend's error body: { error: { code, message, details, requestId } }. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string | null;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors from a VALIDATION_FAILED response, keyed by field name. */
  get fieldErrors(): Record<string, string[]> {
    const fields = this.details.fields;
    return fields && typeof fields === 'object' ? (fields as Record<string, string[]>) : {};
  }

  static network(err: unknown): ApiError {
    return new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
      {
        cause: err instanceof Error ? err.message : String(err),
      },
    );
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

/** Builds an ApiError from any failed response body. */
export function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) {
    const e = body.error;
    return new ApiError(status, e.code, e.message, e.details ?? {}, e.requestId ?? null);
  }
  return new ApiError(status, `HTTP_${status}`, 'Something went wrong. Please try again.');
}
