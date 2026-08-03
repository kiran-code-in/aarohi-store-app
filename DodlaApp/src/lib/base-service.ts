/**
 * base-service.ts — Abstract base class for all Supabase services.
 * Provides shared execute() method with centralized error handling.
 */

import {
  ServiceResult,
  ApiError,
  handleSupabaseError,
  success,
  failure,
  logError,
} from './error-handler';
import { isOnline } from './supabase';

export abstract class BaseService {
  /** Service name used for logging context */
  protected abstract readonly serviceName: string;

  /**
   * Execute a Supabase operation with automatic error handling.
   * Wraps the operation in try/catch and returns a ServiceResult.
   */
  protected async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<ServiceResult<T>> {
    try {
      // Check connectivity first
      if (!isOnline()) {
        return failure<T>(
          new ApiError('Device is offline', 'OFFLINE')
        );
      }

      const data = await operation();
      return success(data);
    } catch (error: unknown) {
      const apiError = handleSupabaseError(error);
      logError(`${this.serviceName}.${operationName}`, apiError);
      return failure<T>(apiError);
    }
  }

  /**
   * Execute a Supabase query and unwrap the { data, error } response.
   * Most Supabase calls return this shape — this helper unwraps it cleanly.
   * Accepts PromiseLike to support Supabase's PostgrestBuilder chain.
   */
  protected async query<T>(
    queryFn: () => PromiseLike<{ data: T | null; error: unknown }>,
    operationName: string = 'query'
  ): Promise<ServiceResult<T>> {
    try {
      if (!isOnline()) {
        return failure<T>(
          new ApiError('Device is offline', 'OFFLINE')
        );
      }

      const { data, error } = await queryFn();

      if (error) {
        const apiError = handleSupabaseError(error);
        logError(`${this.serviceName}.${operationName}`, apiError);
        return failure<T>(apiError);
      }

      if (data === null) {
        return failure<T>(
          new ApiError('No data returned', 'NOT_FOUND')
        );
      }

      return success(data);
    } catch (error: unknown) {
      const apiError = handleSupabaseError(error);
      logError(`${this.serviceName}.${operationName}`, apiError);
      return failure<T>(apiError);
    }
  }
}
