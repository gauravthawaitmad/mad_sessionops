/**
 * ============================================
 * RETRY LOGIC
 * ============================================
 *
 * Auto-retry failed requests.
 */

import { useState } from "react";

/**
 * Retry Options
 */
interface RetryOptions {
  maxRetries?: number; // Max retry attempts (default: 3)
  delay?: number; // Initial delay in ms (default: 1000)
  backoff?: boolean; // Use exponential backoff (default: true)
  retryOn?: (error: any) => boolean; // When to retry (default: network errors)
}

/**
 * Retry Function
 *
 * Retries a function with exponential backoff.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    retryOn = (error) => error.code === "NETWORK_ERROR",
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!retryOn(error)) {
        throw error;
      }

      // Don't wait after last attempt
      if (attempt < maxRetries - 1) {
        // Calculate delay with exponential backoff
        const waitTime = backoff ? delay * Math.pow(2, attempt) : delay;

        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms`);

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * useRetry Hook
 *
 * React hook for retry logic.
 */
export function useRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await retry(fn, options);
      setData(result);

      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error, data };
}
