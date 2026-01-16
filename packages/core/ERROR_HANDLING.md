# Error Handling Guide

> **Learn how to handle errors gracefully in svelte-reactor applications**

This guide covers all aspects of error handling in svelte-reactor, from validation to async operations to production-ready error recovery strategies.

## Table of Contents

- [Understanding Reactor Errors](#understanding-reactor-errors)
- [Handling Different Error Types](#handling-different-error-types)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Production Error Handling](#production-error-handling)
- [Best Practices](#best-practices)

---

## Understanding Reactor Errors

### Error Categories

Reactor applications can encounter four main categories of errors:

1. **Validation Errors** - Invalid user input or state transitions
2. **Persistence Errors** - Storage failures (localStorage, IndexedDB)
3. **Async Errors** - API failures, network issues
4. **Plugin Errors** - Middleware or plugin-specific issues

### Error Flow in Reactor

```
User Action
    ↓
Update/Action Called
    ↓
Middleware (before) ← Can throw errors
    ↓
State Update ← Can throw validation errors
    ↓
Middleware (after) ← Can throw errors
    ↓
Subscribers Notified
    ↓
Persist Plugin ← Can throw storage errors
    ↓
Complete or Error Caught
```

---

## Handling Different Error Types

### 1. Validation Errors

Validation errors occur when state updates violate business rules.

#### Basic Validation

```typescript
import { createReactor } from 'svelte-reactor';

interface UserState {
  age: number;
  email: string;
}

const store = createReactor<UserState>({
  age: 0,
  email: ''
});

// ❌ No validation - allows invalid data
store.update(state => {
  state.age = -5;  // Invalid age!
});

// ✅ With validation - throws error
try {
  store.update(state => {
    if (state.age < 0 || state.age > 150) {
      throw new Error('[Validation] Age must be between 0 and 150');
    }
    state.age = -5;
  });
} catch (error) {
  console.error('Validation failed:', error.message);
  // Show error to user
  showErrorToast(error.message);
}
```

#### Validation Plugin Pattern

For complex validation, create a dedicated validation plugin:

```typescript
import { Plugin } from 'svelte-reactor';
import { z } from 'zod';  // Using Zod for validation

const userSchema = z.object({
  age: z.number().min(0).max(150),
  email: z.string().email()
});

export function validationPlugin<T extends object>(
  schema: z.ZodSchema<T>
): Plugin<T> {
  return {
    name: 'validation',
    init(context) {
      // Validate initial state
      const result = schema.safeParse(context.state);
      if (!result.success) {
        console.error('[Validation] Invalid initial state:', result.error);
      }

      // Add middleware to validate on every update
      context.middlewares.push({
        name: 'validation-middleware',
        before(prevState, nextState, action) {
          const result = schema.safeParse(nextState);
          if (!result.success) {
            const errorMessage = result.error.errors
              .map(err => `${err.path.join('.')}: ${err.message}`)
              .join(', ');

            throw new Error(`[Validation] ${errorMessage}`);
          }
        }
      });
    }
  };
}

// Usage
const store = createReactor(
  { age: 25, email: 'user@example.com' },
  { plugins: [validationPlugin(userSchema)] }
);

// This will throw validation error
try {
  store.update(state => {
    state.email = 'invalid-email';  // Validation will catch this
  });
} catch (error) {
  console.error('Validation failed:', error);
}
```

### 2. Async Errors with asyncActions

The `asyncActions` helper provides built-in error handling for async operations.

#### Basic Async Error Handling

```typescript
import { createReactor, asyncActions } from 'svelte-reactor';

interface AppState {
  users: User[];
  loading: boolean;
  error: string | null;
}

const store = createReactor<AppState>({
  users: [],
  loading: false,
  error: null
});

const api = asyncActions(store, {
  async fetchUsers() {
    const res = await fetch('/api/users');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  },

  async createUser(user: User) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create user');
    }

    return res.json();
  }
});

// In Svelte component
$: if ($store.error) {
  // Auto-populated by asyncActions on error
  console.error('API error:', $store.error);
  showNotification($store.error, 'error');
}

// Call actions - errors are automatically caught
await api.fetchUsers();  // Sets store.error if fails
```

#### Advanced Async Error Handling

```typescript
interface ApiState {
  data: any;
  loading: boolean;
  error: {
    message: string;
    code: string;
    timestamp: number;
    retry?: () => Promise<void>;
  } | null;
}

const store = createReactor<ApiState>({
  data: null,
  loading: false,
  error: null
});

const api = asyncActions(store, {
  async fetchData() {
    try {
      const res = await fetch('/api/data');

      if (!res.ok) {
        // Create detailed error object
        const errorData = await res.json().catch(() => ({}));

        throw {
          message: errorData.message || `HTTP ${res.status}`,
          code: errorData.code || `HTTP_${res.status}`,
          timestamp: Date.now(),
          retry: () => api.fetchData()  // Attach retry function
        };
      }

      return res.json();

    } catch (error) {
      // Transform error into structured format
      if (error instanceof TypeError) {
        // Network error
        throw {
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR',
          timestamp: Date.now(),
          retry: () => api.fetchData()
        };
      }

      throw error;  // Re-throw structured error
    }
  }
});

// In component
$: if ($store.error) {
  console.error('Error:', $store.error.message);

  // Show retry button if available
  if ($store.error.retry) {
    showRetryButton($store.error.retry);
  }
}
```

### 3. Persistence Errors

Persistence errors occur when data cannot be saved to storage.

#### Handling Storage Failures

```typescript
import { createReactor, persist } from 'svelte-reactor';

const store = createReactor(
  { data: [] },
  {
    plugins: [
      persist({
        key: 'app-data',
        storage: localStorage,
        onError: (error, key) => {
          console.error(`[Persist] Failed to save ${key}:`, error);

          // Check error type
          if (error.name === 'QuotaExceededError') {
            // Storage full - notify user
            showNotification(
              'Storage full. Please clear some data.',
              'warning'
            );

            // Try to free space
            clearOldData();

          } else if (error.message.includes('not available')) {
            // Private browsing or disabled storage
            showNotification(
              'Storage unavailable. Data will not persist.',
              'info'
            );

            // Fall back to memory storage
            useFallbackStorage();
          } else {
            // Unknown error
            logErrorToSentry(error);
            showNotification('Failed to save data', 'error');
          }
        }
      })
    ]
  }
);
```

#### Storage Fallback Pattern

```typescript
import {
  createReactor,
  persist,
  MemoryStorage
} from 'svelte-reactor';

let currentStorage: Storage = localStorage;
let hasStorageError = false;

function createStoreWithFallback<T extends object>(
  initialState: T,
  key: string
) {
  return createReactor(initialState, {
    plugins: [
      persist({
        key,
        storage: currentStorage,
        onError: (error, key) => {
          if (!hasStorageError) {
            // First error - switch to memory storage
            console.warn(`[Persist] Switching to memory storage due to:`, error);
            hasStorageError = true;
            currentStorage = new MemoryStorage();

            showNotification(
              'Using temporary storage. Data will be lost on page reload.',
              'warning'
            );
          } else {
            // Already using fallback - just log
            console.error(`[Persist] Memory storage error:`, error);
          }
        }
      })
    ]
  });
}

// Usage
const store = createStoreWithFallback({ count: 0 }, 'counter');
```

#### IndexedDB Error Handling

```typescript
import { createReactor, persist, IndexedDBStorage } from 'svelte-reactor';

async function createPersistedStore() {
  try {
    // Try to create IndexedDB storage
    const storage = new IndexedDBStorage('myapp', 'stores');
    await storage.init();

    return createReactor(
      { data: [] },
      {
        plugins: [
          persist({
            storage,
            onError: (error) => {
              console.error('[IndexedDB] Error:', error);

              if (error.message.includes('version')) {
                // Version conflict - clear and retry
                storage.delete('myapp');
                location.reload();
              }
            }
          })
        ]
      }
    );

  } catch (error) {
    console.error('[IndexedDB] Initialization failed:', error);

    // Fall back to localStorage
    return createReactor(
      { data: [] },
      {
        plugins: [
          persist({
            storage: localStorage,
            onError: (err) => console.error('[localStorage] Error:', err)
          })
        ]
      }
    );
  }
}
```

### 4. Plugin and Middleware Errors

Plugin errors occur in custom plugins or middleware.

#### Safe Middleware Pattern

```typescript
import { Middleware } from 'svelte-reactor';

export const loggingMiddleware: Middleware<any> = {
  name: 'logger',

  before(prevState, nextState, action) {
    try {
      console.log('[Before]', action, { prevState, nextState });
    } catch (error) {
      // Don't block state updates due to logging errors
      console.error('[Logger] Before hook failed:', error);
    }
  },

  after(prevState, nextState, action) {
    try {
      console.log('[After]', action, { prevState, nextState });

      // Send to analytics
      sendToAnalytics(action, nextState);
    } catch (error) {
      // Non-critical error - just log
      console.error('[Logger] After hook failed:', error);
    }
  },

  onError(error) {
    // Handle errors from other middleware
    console.error('[Logger] Caught error:', error);

    // Send to error tracking
    logToSentry({
      error,
      context: 'middleware-error',
      timestamp: Date.now()
    });
  }
};
```

#### Plugin Error Handling

```typescript
import { Plugin } from 'svelte-reactor';

export function analyticsPlugin(config: AnalyticsConfig): Plugin<any> {
  let analytics: Analytics | null = null;

  return {
    name: 'analytics',

    init(context) {
      try {
        // Initialize analytics service
        analytics = new Analytics(config);

        // Add middleware
        context.middlewares.push({
          name: 'analytics-tracker',
          after(prevState, nextState, action) {
            try {
              analytics?.track(action, {
                prevState,
                nextState,
                timestamp: Date.now()
              });
            } catch (error) {
              // Don't fail state updates due to tracking errors
              console.error('[Analytics] Tracking failed:', error);
            }
          }
        });

      } catch (error) {
        // Plugin initialization failed - log and continue
        console.error('[Analytics] Plugin initialization failed:', error);
        // Don't throw - allow app to continue without analytics
      }
    },

    destroy() {
      try {
        analytics?.disconnect();
      } catch (error) {
        console.error('[Analytics] Cleanup failed:', error);
      }
    }
  };
}
```

---

## Error Recovery Strategies

### Strategy 1: Retry with Exponential Backoff

For transient errors (network issues, rate limiting), retry with increasing delays.

```typescript
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

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;  // Add jitter

      console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError!;
}

// Usage with asyncActions
const api = asyncActions(store, {
  async fetchUsers() {
    return fetchWithRetry(async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }
});
```

### Strategy 2: Fallback to Default State

When errors occur, gracefully fall back to default/safe state.

```typescript
import { createReactor } from 'svelte-reactor';

interface AppState {
  user: User | null;
  preferences: Preferences;
  hasError: boolean;
}

const defaultPreferences: Preferences = {
  theme: 'light',
  notifications: true,
  language: 'en'
};

const store = createReactor<AppState>({
  user: null,
  preferences: defaultPreferences,
  hasError: false
});

// Reset to defaults on error
function resetToDefaults() {
  store.update(state => {
    state.preferences = { ...defaultPreferences };
    state.hasError = false;
  });

  showNotification('Settings reset to defaults', 'info');
}

// Try to load preferences, fall back to defaults
async function loadPreferences() {
  try {
    const saved = localStorage.getItem('preferences');
    if (saved) {
      const preferences = JSON.parse(saved);
      store.update(state => {
        state.preferences = preferences;
      });
    }
  } catch (error) {
    console.error('[Preferences] Load failed:', error);

    // Fall back to defaults
    resetToDefaults();

    // Try to clear corrupted data
    try {
      localStorage.removeItem('preferences');
    } catch (err) {
      console.error('[Preferences] Clear failed:', err);
    }
  }
}
```

### Strategy 3: Graceful Degradation

Continue operating with reduced functionality when errors occur.

```typescript
interface FeatureFlags {
  analytics: boolean;
  persist: boolean;
  sync: boolean;
  advancedFeatures: boolean;
}

const features = createReactor<FeatureFlags>({
  analytics: true,
  persist: true,
  sync: true,
  advancedFeatures: true
});

// Disable features gracefully on error
function handleFeatureError(feature: keyof FeatureFlags, error: Error) {
  console.error(`[Feature:${feature}] Error:`, error);

  features.update(state => {
    state[feature] = false;
  });

  // Notify user (optional)
  showNotification(
    `${feature} is temporarily unavailable`,
    'warning',
    { dismissable: true }
  );
}

// Try to enable feature, disable on error
async function enableAnalytics() {
  try {
    await initializeAnalytics();
    features.update(state => { state.analytics = true; });
  } catch (error) {
    handleFeatureError('analytics', error as Error);
  }
}

// In component - conditionally render based on feature flags
$: if ($features.advancedFeatures) {
  // Show advanced UI
} else {
  // Show basic UI
}
```

### Strategy 4: Error Boundaries (Component Level)

Catch errors in components and prevent app crash.

```svelte
<!-- ErrorBoundary.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let error: Error | null = null;
  let errorInfo: any = null;

  function handleError(event: ErrorEvent) {
    error = event.error;
    errorInfo = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    };

    // Log to error tracking
    console.error('[ErrorBoundary]', error, errorInfo);

    // Prevent error from propagating
    event.preventDefault();
  }

  function reset() {
    error = null;
    errorInfo = null;
  }

  onMount(() => {
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  });
</script>

{#if error}
  <div class="error-boundary">
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button on:click={reset}>Try Again</button>
  </div>
{:else}
  <slot />
{/if}

<style>
  .error-boundary {
    padding: 2rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 8px;
  }
</style>
```

---

## Production Error Handling

### Sentry Integration

Full error tracking with Sentry:

```typescript
import * as Sentry from '@sentry/browser';
import { createReactor, Plugin } from 'svelte-reactor';

// Initialize Sentry
Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1
});

// Sentry error tracking plugin
export function sentryPlugin<T extends object>(): Plugin<T> {
  return {
    name: 'sentry',
    init(context) {
      // Track state updates
      context.middlewares.push({
        name: 'sentry-tracker',

        onError(error) {
          // Capture error with context
          Sentry.captureException(error, {
            tags: {
              reactor: context.name,
              component: 'reactor'
            },
            contexts: {
              state: {
                current: context.state
              }
            }
          });
        },

        after(prevState, nextState, action) {
          // Add breadcrumb for debugging
          Sentry.addBreadcrumb({
            type: 'state-update',
            category: 'reactor',
            message: `Action: ${action || 'unknown'}`,
            level: 'info',
            data: {
              reactor: context.name,
              action
            }
          });
        }
      });
    }
  };
}

// Usage
const store = createReactor(
  { count: 0 },
  {
    plugins: [sentryPlugin()],
    name: 'counter'
  }
);
```

### Error Logging Best Practices

```typescript
// Structured logging utility
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  data?: any;
  timestamp: number;
  error?: Error;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private log(entry: Omit<LogEntry, 'timestamp'>) {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: Date.now()
    };

    this.logs.push(logEntry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const method = entry.level === 'error' ? 'error' :
                   entry.level === 'warn' ? 'warn' : 'log';
    console[method](`[${entry.level.toUpperCase()}]`, entry.message, entry.data);

    // Send critical errors to backend
    if (entry.level === 'error' && entry.error) {
      this.sendToBackend(logEntry);
    }
  }

  info(message: string, context?: string, data?: any) {
    this.log({ level: 'info', message, context, data });
  }

  warn(message: string, context?: string, data?: any) {
    this.log({ level: 'warn', message, context, data });
  }

  error(message: string, error: Error, context?: string, data?: any) {
    this.log({ level: 'error', message, context, data, error });
  }

  debug(message: string, context?: string, data?: any) {
    if (import.meta.env.DEV) {
      this.log({ level: 'debug', message, context, data });
    }
  }

  getLogs() {
    return this.logs;
  }

  private async sendToBackend(entry: LogEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Silent fail - don't log errors about logging
      console.error('[Logger] Failed to send log:', error);
    }
  }
}

export const logger = new Logger();

// Usage in reactor
const store = createReactor(
  { data: [] },
  {
    onChange: (nextState, prevState, action) => {
      logger.debug('State updated', 'reactor', { action, nextState });
    },
    plugins: [
      {
        name: 'error-logger',
        init(context) {
          context.middlewares.push({
            name: 'error-logger-middleware',
            onError(error) {
              logger.error(
                'State update failed',
                error,
                'reactor',
                { reactor: context.name }
              );
            }
          });
        }
      }
    ]
  }
);
```

### User-Friendly Error Messages

```typescript
// Map technical errors to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  'QuotaExceededError': 'Storage is full. Please free up some space.',
  'NetworkError': 'Unable to connect. Please check your internet connection.',
  'HTTP_401': 'Your session has expired. Please log in again.',
  'HTTP_403': 'You don\'t have permission to do that.',
  'HTTP_404': 'The requested resource was not found.',
  'HTTP_500': 'Server error. Please try again later.',
  'ValidationError': 'Please check your input and try again.',
};

export function getUserFriendlyMessage(error: Error): string {
  // Try to match error name/code
  if (error.name in ERROR_MESSAGES) {
    return ERROR_MESSAGES[error.name];
  }

  // Check for HTTP errors in message
  const httpMatch = error.message.match(/HTTP[_\s](\d+)/);
  if (httpMatch) {
    const code = `HTTP_${httpMatch[1]}`;
    if (code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[code];
    }
  }

  // Check for validation errors
  if (error.message.includes('[Validation]')) {
    return ERROR_MESSAGES['ValidationError'];
  }

  // Default generic message
  return 'Something went wrong. Please try again.';
}

// Usage
try {
  await api.fetchData();
} catch (error) {
  const message = getUserFriendlyMessage(error as Error);
  showNotification(message, 'error');

  // Still log technical details
  logger.error('API call failed', error as Error, 'api');
}
```

---

## Best Practices

### 1. Always Handle Errors

```typescript
// ❌ Bad - unhandled errors crash app
api.fetchUsers();  // No error handling

// ✅ Good - errors are caught
try {
  await api.fetchUsers();
} catch (error) {
  handleError(error);
}

// ✅ Better - using asyncActions (auto-handles errors)
const api = asyncActions(store, { fetchUsers });
await api.fetchUsers();  // Errors set store.error
```

### 2. Fail Gracefully

```typescript
// ❌ Bad - throws and breaks app
function loadSettings() {
  const data = JSON.parse(localStorage.getItem('settings')!);
  return data;  // Crashes if data is null or invalid
}

// ✅ Good - falls back to defaults
function loadSettings() {
  try {
    const data = localStorage.getItem('settings');
    if (!data) return defaultSettings;
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
}
```

### 3. Log Errors Appropriately

```typescript
// ❌ Bad - no context
console.error(error);

// ✅ Good - structured logging with context
logger.error(
  'Failed to save user preferences',
  error,
  'preferences',
  { userId, action: 'save', preferences }
);
```

### 4. Don't Swallow Errors Silently

```typescript
// ❌ Bad - error is hidden
try {
  await criticalOperation();
} catch (error) {
  // Silent fail - users don't know something went wrong
}

// ✅ Good - inform user and log error
try {
  await criticalOperation();
} catch (error) {
  logger.error('Critical operation failed', error, 'app');
  showNotification('Operation failed. Please try again.', 'error');
  // Optionally: fall back to alternative flow
}
```

### 5. Validate Early, Fail Fast

```typescript
// ❌ Bad - errors discovered late in process
async function processOrder(order) {
  await saveToDatabase(order);
  await sendConfirmationEmail(order);
  // Validation happens here - too late!
  if (!isValid(order)) throw new Error('Invalid order');
}

// ✅ Good - validate immediately
async function processOrder(order) {
  // Fail fast if invalid
  if (!isValid(order)) {
    throw new Error('Invalid order');
  }

  await saveToDatabase(order);
  await sendConfirmationEmail(order);
}
```

### 6. Provide Recovery Options

```typescript
// ❌ Bad - no way to recover
showNotification('Failed to load data', 'error');

// ✅ Good - give user options
showNotification('Failed to load data', 'error', {
  actions: [
    { label: 'Retry', onClick: () => retryLoad() },
    { label: 'Use Cached Data', onClick: () => useCachedData() },
    { label: 'Reload Page', onClick: () => location.reload() }
  ]
});
```

### 7. Test Error Paths

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Error Handling', () => {
  it('should handle network errors', async () => {
    // Mock fetch to fail
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const store = createReactor({ data: null, error: null });
    const api = asyncActions(store, { fetchData });

    await api.fetchData();

    // Verify error is set
    expect(store.state.error).toBeTruthy();
    expect(store.state.error).toContain('Network error');
  });

  it('should retry on transient errors', async () => {
    let attempts = 0;
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Temporary error'));
      }
      return Promise.resolve(new Response('{"success":true}'));
    });

    const result = await fetchWithRetry(() => fetch('/api/data'));

    expect(attempts).toBe(3);
    expect(result).toBeDefined();
  });
});
```

---

## Summary

Effective error handling in svelte-reactor requires:

1. **Understanding** error categories and their sources
2. **Catching** errors at the right level (validation, async, persistence, plugins)
3. **Recovering** gracefully with fallbacks, retries, and degradation
4. **Logging** errors with proper context for debugging
5. **Informing** users with friendly messages and recovery options
6. **Testing** error paths to ensure resilience

By following these patterns, you'll build robust applications that handle failures gracefully and provide excellent user experience even when things go wrong.

---

## See Also

- [API Documentation](./API.md) - Full API reference
- [Plugin Guide](./PLUGINS.md) - Creating custom plugins
- [Performance Guide](./PERFORMANCE_GUIDE.md) - Optimization strategies
- [Examples](./examples/) - Real-world error handling examples
