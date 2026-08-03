/**
 * error-handler.ts — Centralized error handling for all Supabase operations.
 * Provides: ApiError class, ServiceResult<T> type, handleSupabaseError utility.
 */

// ═══════════════════════════════════════════════════════════════
//  SERVICE RESULT TYPE
// ═══════════════════════════════════════════════════════════════

/**
 * Standard return type for all service methods.
 * Either data is present (success) or error is present (failure).
 */
export interface ServiceResult<T> {
  data: T | null;
  error: ApiError | null;
}

// ═══════════════════════════════════════════════════════════════
//  API ERROR CLASS
// ═══════════════════════════════════════════════════════════════

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'
  | 'OFFLINE';

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number | null;
  public readonly details: string | null;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = 'UNKNOWN_ERROR',
    statusCode: number | null = null,
    details: string | null = null
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /** User-friendly message for display in UI */
  get displayMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
      case 'OFFLINE':
        return 'No internet connection. Changes saved locally.';
      case 'NOT_FOUND':
        return 'Record not found.';
      case 'VALIDATION_ERROR':
        return 'Invalid data. Please check your input.';
      case 'PERMISSION_DENIED':
        return 'Access denied.';
      case 'CONFLICT':
        return 'Data conflict. Please refresh and try again.';
      case 'SERVER_ERROR':
        return 'Server error. Please try again later.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  ERROR HANDLING UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a Supabase error response into an ApiError.
 */
export function handleSupabaseError(error: unknown): ApiError {
  // Supabase PostgrestError shape: { message, details, hint, code }
  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as { message?: string; details?: string; code?: string; hint?: string };
    const message = pgError.message || 'Database error';
    const details = pgError.details || pgError.hint || null;
    const code = mapPostgrestCode(pgError.code);
    return new ApiError(message, code, null, details);
  }

  // Network/fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError('Network request failed', 'NETWORK_ERROR');
  }

  // Generic Error
  if (error instanceof Error) {
    return new ApiError(error.message, 'UNKNOWN_ERROR');
  }

  // Fallback
  return new ApiError('An unexpected error occurred', 'UNKNOWN_ERROR');
}

/**
 * Map Supabase/Postgres error codes to our ErrorCode enum.
 */
function mapPostgrestCode(code: string | undefined): ErrorCode {
  if (!code) return 'UNKNOWN_ERROR';

  // HTTP-like codes from PostgREST
  if (code === 'PGRST116' || code === '404') return 'NOT_FOUND';
  if (code === '401' || code === '403' || code === '42501') return 'PERMISSION_DENIED';
  if (code === '409' || code === '23505') return 'CONFLICT'; // unique violation
  if (code === '400' || code === '22P02' || code === '23502') return 'VALIDATION_ERROR';
  if (code.startsWith('5')) return 'SERVER_ERROR';

  return 'UNKNOWN_ERROR';
}

/**
 * Create a success result.
 */
export function success<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

/**
 * Create an error result.
 */
export function failure<T>(error: ApiError): ServiceResult<T> {
  return { data: null, error };
}

/**
 * Log error for debugging (non-production could send to monitoring).
 */
export function logError(context: string, error: ApiError): void {
  console.error(`[${context}] ${error.code}: ${error.message}`, {
    details: error.details,
    timestamp: error.timestamp,
  });
}
