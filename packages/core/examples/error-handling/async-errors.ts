/**
 * Example: Async Error Handling
 *
 * Demonstrates how to handle async errors in svelte-reactor:
 * - Using asyncActions for automatic error handling
 * - Retry logic with exponential backoff
 * - Network error detection and recovery
 * - User-friendly error messages
 */

import { createReactor } from '../../src/core/reactor.svelte';
import { asyncActions } from '../../src/helpers/async-actions';

// =============================================================================
// Example 1: Basic Async Error Handling with asyncActions
// =============================================================================

interface ApiState {
  users: User[];
  loading: boolean;
  error: string | null;
}

interface User {
  id: number;
  name: string;
  email: string;
}

// Mock API that randomly fails
let callCount = 0;
const mockFetch = async (url: string, shouldFail = false): Promise<Response> => {
  callCount++;
  await new Promise(resolve => setTimeout(resolve, 100));

  if (shouldFail || Math.random() < 0.3) {
    throw new Error('Network error: Failed to fetch');
  }

  const data = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];

  return {
    ok: true,
    json: async () => data,
    status: 200,
    statusText: 'OK'
  } as Response;
};

export async function basicAsyncErrorExample() {
  console.log('\n=== Example 1: Basic Async Error Handling ===\n');

  const store = createReactor<ApiState>({
    users: [],
    loading: false,
    error: null
  });

  const api = asyncActions(store, {
    async fetchUsers() {
      const res = await mockFetch('/api/users', true);  // Force failure
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    }
  });

  // Subscribe to error state
  const unsubscribe = store.subscribe(state => {
    if (state.error) {
      console.log('❌ Error detected:', state.error);
    }
    if (state.loading) {
      console.log('⏳ Loading...');
    }
    if (!state.loading && !state.error && state.users.length > 0) {
      console.log('✅ Users loaded:', state.users.length);
    }
  });

  // Try to fetch - will fail
  await api.fetchUsers();

  console.log('\nFinal state:', {
    users: store.state.users,
    loading: store.state.loading,
    error: store.state.error
  });

  unsubscribe();
  store.destroy();
}

// =============================================================================
// Example 2: Retry with Exponential Backoff
// =============================================================================

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (error instanceof Response && error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        // Calculate delay with exponential backoff + jitter
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;

        console.log(`⚠️  Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay + jitter)}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError!;
}

export async function retryWithBackoffExample() {
  console.log('\n=== Example 2: Retry with Exponential Backoff ===\n');

  const store = createReactor<ApiState>({
    users: [],
    loading: false,
    error: null
  });

  const api = asyncActions(store, {
    async fetchUsers() {
      return fetchWithRetry(async () => {
        console.log(`📡 Attempting API call... (attempt #${callCount + 1})`);
        const res = await mockFetch('/api/users');  // May randomly fail
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    }
  });

  // Reset call counter
  callCount = 0;

  await api.fetchUsers();

  console.log('\n✅ Success after', callCount, 'attempts');
  console.log('Final state:', {
    users: store.state.users.length,
    error: store.state.error
  });

  store.destroy();
}

// =============================================================================
// Example 3: Detailed Error Objects
// =============================================================================

interface DetailedApiState {
  data: any;
  loading: boolean;
  error: {
    message: string;
    code: string;
    timestamp: number;
    retry?: () => Promise<void>;
  } | null;
}

export async function detailedErrorExample() {
  console.log('\n=== Example 3: Detailed Error Objects ===\n');

  const store = createReactor<DetailedApiState>({
    data: null,
    loading: false,
    error: null
  });

  const api = asyncActions(store, {
    async fetchData() {
      try {
        const res = await mockFetch('/api/data', true);  // Force failure

        if (!res.ok) {
          // Create detailed error object
          throw {
            message: `Failed to fetch data: HTTP ${res.status}`,
            code: `HTTP_${res.status}`,
            timestamp: Date.now(),
            retry: () => api.fetchData()  // Attach retry function
          };
        }

        return res.json();

      } catch (error) {
        // Transform network errors into structured format
        if (error instanceof TypeError || (error as Error).message.includes('Network error')) {
          throw {
            message: 'Network error. Please check your internet connection.',
            code: 'NETWORK_ERROR',
            timestamp: Date.now(),
            retry: () => api.fetchData()
          };
        }

        throw error;  // Re-throw structured errors as-is
      }
    }
  });

  await api.fetchData();

  if (store.state.error) {
    console.log('❌ Error details:');
    console.log('  Message:', store.state.error.message);
    console.log('  Code:', store.state.error.code);
    console.log('  Time:', new Date(store.state.error.timestamp).toLocaleTimeString());
    console.log('  Can retry:', !!store.state.error.retry);
  }

  store.destroy();
}

// =============================================================================
// Example 4: Cancellation and Cleanup
// =============================================================================

interface TaskState {
  result: string | null;
  loading: boolean;
  error: string | null;
  cancelled: boolean;
}

export async function cancellationExample() {
  console.log('\n=== Example 4: Cancellation and Cleanup ===\n');

  const store = createReactor<TaskState>({
    result: null,
    loading: false,
    error: null,
    cancelled: false
  });

  let abortController: AbortController | null = null;

  const api = asyncActions(store, {
    async longRunningTask() {
      // Create new abort controller for this task
      abortController = new AbortController();

      try {
        console.log('🚀 Starting long task...');

        // Simulate long-running task
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 3000);

          // Listen for cancellation
          abortController!.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Task cancelled by user'));
          });
        });

        return 'Task completed successfully!';

      } catch (error) {
        if ((error as Error).message.includes('cancelled')) {
          console.log('⚠️  Task was cancelled');
          store.update(state => {
            state.cancelled = true;
          });
          throw new Error('[Cancelled] Task was cancelled by user');
        }
        throw error;
      }
    }
  });

  // Start the task (don't await)
  const taskPromise = api.longRunningTask();

  // Cancel after 500ms
  setTimeout(() => {
    console.log('❌ Cancelling task...');
    if (abortController) {
      abortController.abort();
    }
  }, 500);

  // Wait for result (will be cancelled)
  await taskPromise;

  console.log('\nFinal state:', {
    result: store.state.result,
    cancelled: store.state.cancelled,
    error: store.state.error
  });

  store.destroy();
}

// =============================================================================
// Example 5: Error Recovery Strategies
// =============================================================================

interface RecoveryState {
  data: any[];
  cachedData: any[];
  loading: boolean;
  error: string | null;
  usingCache: boolean;
}

export async function errorRecoveryExample() {
  console.log('\n=== Example 5: Error Recovery Strategies ===\n');

  const store = createReactor<RecoveryState>({
    data: [],
    cachedData: [{ id: 1, name: 'Cached User' }],  // Simulate cached data
    loading: false,
    error: null,
    usingCache: false
  });

  const api = asyncActions(store, {
    async fetchData() {
      try {
        const res = await mockFetch('/api/data', true);  // Force failure
        if (!res.ok) throw new Error('API failed');

        const data = await res.json();

        // Update with fresh data
        store.update(state => {
          state.data = data;
          state.usingCache = false;
        });

        return data;

      } catch (error) {
        console.warn('❌ API failed, falling back to cache');

        // Fallback: Use cached data
        store.update(state => {
          state.data = state.cachedData;
          state.usingCache = true;
          state.error = null;  // Clear error since we recovered
        });

        // Show user-friendly message
        console.log('⚠️  Using cached data (offline mode)');

        return store.state.cachedData;
      }
    }
  });

  await api.fetchData();

  console.log('\nRecovered state:', {
    dataCount: store.state.data.length,
    usingCache: store.state.usingCache,
    error: store.state.error
  });

  store.destroy();
}

// =============================================================================
// Example 6: User-Friendly Error Messages
// =============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  'NetworkError': 'Unable to connect. Please check your internet connection.',
  'HTTP_401': 'Your session has expired. Please log in again.',
  'HTTP_403': "You don't have permission to do that.",
  'HTTP_404': 'The requested resource was not found.',
  'HTTP_500': 'Server error. Please try again later.',
  'HTTP_503': 'Service temporarily unavailable. Please try again in a few minutes.',
};

function getUserFriendlyMessage(error: Error): string {
  // Check for HTTP errors
  const httpMatch = error.message.match(/HTTP[_\s](\d+)/);
  if (httpMatch) {
    const code = `HTTP_${httpMatch[1]}`;
    if (code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[code];
    }
  }

  // Check for network errors
  if (error.message.includes('Network error') || error.message.includes('Failed to fetch')) {
    return ERROR_MESSAGES['NetworkError'];
  }

  // Default generic message
  return 'Something went wrong. Please try again.';
}

export async function userFriendlyErrorsExample() {
  console.log('\n=== Example 6: User-Friendly Error Messages ===\n');

  const store = createReactor<ApiState>({
    users: [],
    loading: false,
    error: null
  });

  const api = asyncActions(store, {
    async fetchUsers() {
      const res = await mockFetch('/api/users', true);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    }
  });

  await api.fetchUsers();

  if (store.state.error) {
    const technicalError = store.state.error;
    const userMessage = getUserFriendlyMessage(new Error(technicalError));

    console.log('Technical error:', technicalError);
    console.log('👤 User sees:', userMessage);
  }

  store.destroy();
}

// =============================================================================
// Run all examples
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    ASYNC ERROR HANDLING                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  await basicAsyncErrorExample();
  await retryWithBackoffExample();
  await detailedErrorExample();
  await cancellationExample();
  await errorRecoveryExample();
  await userFriendlyErrorsExample();

  console.log('\n✅ All async error examples completed!\n');
}
