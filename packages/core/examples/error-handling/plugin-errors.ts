/**
 * Example: Plugin and Middleware Error Handling
 *
 * Demonstrates how to handle errors in plugins and middleware:
 * - Safe middleware pattern (try-catch in hooks)
 * - Plugin initialization errors
 * - Error propagation and handling
 * - Error recovery in middleware chain
 */

import { createReactor } from '../../src/core/reactor.svelte';
import type { ReactorPlugin, Middleware, PluginContext } from '../../src/types';

// =============================================================================
// Example 1: Safe Middleware Pattern
// =============================================================================

interface LogState {
  count: number;
  items: string[];
}

const safeLoggingMiddleware: Middleware<LogState> = {
  name: 'safe-logger',

  onBeforeUpdate(prevState, nextState, action) {
    try {
      console.log('[Before]', action, { count: nextState.count });

      // Simulate potential error in logging
      if (nextState.count > 1000) {
        throw new Error('Logging service unavailable');
      }
    } catch (error) {
      // Don't block state updates due to logging errors
      console.error('[Logger] Before hook failed:', (error as Error).message);
      // Continue with update anyway
    }
  },

  onAfterUpdate(prevState, nextState, action) {
    try {
      console.log('[After]', action, { count: nextState.count });

      // Send to analytics (might fail)
      // sendToAnalytics(action, nextState);
    } catch (error) {
      // Non-critical error - just log
      console.error('[Logger] After hook failed:', (error as Error).message);
    }
  },

  onError(error) {
    // Handle errors from other middleware
    console.error('[Logger] Caught error from middleware chain:', (error as Error).message);

    // Log to error tracking service
    // logToSentry({ error, context: 'middleware-error' });
  }
};

// Helper function to wrap middleware in a plugin
function middlewarePlugin<T extends object>(middleware: Middleware<T>): ReactorPlugin<T> {
  return {
    name: `${middleware.name}-plugin`,
    init(context) {
      context.middlewares.push(middleware);
    }
  };
}

export function safeMiddlewareExample() {
  console.log('\n=== Example 1: Safe Middleware Pattern ===\n');

  const store = createReactor<LogState>(
    { count: 0, items: [] },
    {
      plugins: [middlewarePlugin(safeLoggingMiddleware)]
    }
  );

  // Normal update
  store.update(state => {
    state.count++;
  });

  // Update that triggers logging error (but still succeeds)
  store.update(state => {
    state.count = 1001;  // Will trigger error in logger, but update succeeds
  });

  console.log('✅ State updated despite logging error:', store.state.count);

  store.destroy();
}

// =============================================================================
// Example 2: Plugin Initialization Error Handling
// =============================================================================

interface AnalyticsConfig {
  apiKey: string;
  enabled: boolean;
}

// Simulated Analytics service
class Analytics {
  constructor(config: AnalyticsConfig) {
    if (!config.apiKey) {
      throw new Error('Analytics API key is required');
    }
    if (config.apiKey.length < 10) {
      throw new Error('Invalid analytics API key');
    }
  }

  track(action: string, data: any): void {
    // Simulate tracking
  }

  disconnect(): void {
    // Cleanup
  }
}

function analyticsPlugin(config: AnalyticsConfig): ReactorPlugin<any> {
  let analytics: Analytics | null = null;
  let initializationFailed = false;

  return {
    name: 'analytics',

    init(context) {
      try {
        // Try to initialize analytics service
        analytics = new Analytics(config);
        console.log('✅ Analytics plugin initialized');

        // Add middleware to track state changes
        context.middlewares.push({
          name: 'analytics-tracker',

          onAfterUpdate(prevState, nextState, action) {
            try {
              if (analytics) {
                analytics.track(action || 'unknown', {
                  prevState,
                  nextState,
                  timestamp: Date.now()
                });
              }
            } catch (error) {
              // Don't fail state updates due to tracking errors
              console.error('[Analytics] Tracking failed:', (error as Error).message);
            }
          }
        });

      } catch (error) {
        // Plugin initialization failed - log and continue
        console.error('[Analytics] Plugin initialization failed:', (error as Error).message);
        initializationFailed = true;
        console.log('⚠️  App will continue without analytics');
        // Don't throw - allow app to continue
      }
    },

    destroy() {
      try {
        if (analytics) {
          analytics.disconnect();
        }
      } catch (error) {
        console.error('[Analytics] Cleanup failed:', (error as Error).message);
      }
    }
  };
}

export function pluginInitializationExample() {
  console.log('\n=== Example 2: Plugin Initialization Errors ===\n');

  // Try with invalid config - plugin fails but app continues
  console.log('Attempt 1: Invalid API key');
  const store1 = createReactor(
    { count: 0 },
    {
      plugins: [
        analyticsPlugin({
          apiKey: 'short',  // Too short - will fail
          enabled: true
        })
      ]
    }
  );

  // App still works
  store1.update(state => {
    state.count++;
  });
  console.log('✅ App still works:', store1.state);
  store1.destroy();

  // Try with valid config - plugin succeeds
  console.log('\nAttempt 2: Valid API key');
  const store2 = createReactor(
    { count: 0 },
    {
      plugins: [
        analyticsPlugin({
          apiKey: 'valid-api-key-12345',  // Valid
          enabled: true
        })
      ]
    }
  );

  store2.update(state => {
    state.count++;
  });
  console.log('✅ With analytics:', store2.state);
  store2.destroy();
}

// =============================================================================
// Example 3: Error Propagation in Middleware Chain
// =============================================================================

const validatorMiddleware: Middleware<{ value: number }> = {
  name: 'validator',

  onBeforeUpdate(prevState, nextState, action) {
    if (nextState.value < 0) {
      throw new Error('[Validation] Value cannot be negative');
    }
  }
};

const persistMiddleware: Middleware<{ value: number }> = {
  name: 'persist',

  onAfterUpdate(prevState, nextState, action) {
    console.log('💾 Persisting:', nextState);
  },

  onError(error) {
    console.log('⚠️  Persist middleware caught error:', (error as Error).message);
    console.log('💡 Data will not be persisted due to validation error');
  }
};

const loggingMiddleware: Middleware<{ value: number }> = {
  name: 'logger',

  onAfterUpdate(prevState, nextState, action) {
    console.log('📝 Logged:', action);
  },

  onError(error) {
    console.log('⚠️  Logger caught error:', (error as Error).message);
    console.log('📊 Sending error to monitoring service...');
  }
};

export function errorPropagationExample() {
  console.log('\n=== Example 3: Error Propagation in Middleware ===\n');

  const store = createReactor(
    { value: 10 },
    {
      plugins: [
        middlewarePlugin(validatorMiddleware),
        middlewarePlugin(persistMiddleware),
        middlewarePlugin(loggingMiddleware)
      ]
    }
  );

  console.log('Initial state:', store.state);

  // Valid update - all middleware runs
  console.log('\nValid update (value: 20):');
  store.update(state => {
    state.value = 20;
  });

  // Invalid update - validation fails, onError hooks run
  console.log('\nInvalid update (value: -5):');
  try {
    store.update(state => {
      state.value = -5;
    });
  } catch (error) {
    console.log('❌ Update failed:', (error as Error).message);
  }

  console.log('\n✅ State unchanged:', store.state);

  store.destroy();
}

// =============================================================================
// Example 4: Resilient Plugin with Retry Logic
// =============================================================================

interface ExternalServiceConfig {
  url: string;
  retryAttempts: number;
}

function externalServicePlugin(config: ExternalServiceConfig): ReactorPlugin<any> {
  let connectionAttempts = 0;

  return {
    name: 'external-service',

    init(context) {
      console.log('🔌 Connecting to external service...');

      // Try to connect with retries
      const tryConnect = async () => {
        for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
          try {
            connectionAttempts++;
            console.log(`  Attempt ${attempt + 1}/${config.retryAttempts}...`);

            // Simulate connection attempt
            if (Math.random() < 0.6) {  // 60% chance of failure
              throw new Error('Connection timeout');
            }

            console.log('  ✅ Connected successfully');
            return true;

          } catch (error) {
            if (attempt < config.retryAttempts - 1) {
              const delay = Math.pow(2, attempt) * 100;
              console.log(`  ⚠️  Failed, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              console.error('  ❌ All connection attempts failed');
              console.log('  ⚠️  Plugin will operate in offline mode');
            }
          }
        }
        return false;
      };

      // Start connection (don't await - allow app to continue)
      tryConnect();

      // Add middleware that works even if connection failed
      context.middlewares.push({
        name: 'external-service-sync',

        onAfterUpdate(prevState, nextState, action) {
          try {
            // Queue data for sync (works offline)
            console.log('📤 Queued for sync:', action);
          } catch (error) {
            console.error('[ExternalService] Sync failed:', (error as Error).message);
          }
        }
      });
    }
  };
}

export async function resilientPluginExample() {
  console.log('\n=== Example 4: Resilient Plugin with Retry ===\n');

  const store = createReactor(
    { data: [] as string[] },
    {
      plugins: [
        externalServicePlugin({
          url: 'https://api.example.com',
          retryAttempts: 3
        })
      ]
    }
  );

  // Wait for connection attempts
  await new Promise(resolve => setTimeout(resolve, 500));

  // App continues to work regardless of connection status
  console.log('\n📝 Making updates (plugin may or may not be connected)...');

  store.update(state => {
    state.data.push('Item 1');
  });

  store.update(state => {
    state.data.push('Item 2');
  });

  console.log('\n✅ App works regardless of plugin status:', store.state.data.length);

  store.destroy();
}

// =============================================================================
// Example 5: Error Recovery Strategy
// =============================================================================

interface MonitoringState {
  operations: string[];
  errorCount: number;
  lastError: string | null;
}

function monitoringPlugin(): ReactorPlugin<MonitoringState> {
  let consecutiveErrors = 0;
  const MAX_ERRORS = 3;
  let isDisabled = false;

  return {
    name: 'monitoring',

    init(context) {
      context.middlewares.push({
        name: 'error-monitoring',

        onAfterUpdate(prevState, nextState, action) {
          if (isDisabled) {
            return;  // Plugin disabled due to too many errors
          }

          try {
            // Simulate monitoring service that might fail
            if (Math.random() < 0.3) {
              throw new Error('Monitoring service timeout');
            }

            // Reset error count on success
            consecutiveErrors = 0;
            console.log('✅ Monitoring: operation tracked');

          } catch (error) {
            consecutiveErrors++;
            console.error(`❌ Monitoring error (${consecutiveErrors}/${MAX_ERRORS}):`, (error as Error).message);

            if (consecutiveErrors >= MAX_ERRORS) {
              isDisabled = true;
              console.log('⚠️  Too many errors - disabling monitoring plugin');
              console.log('💡 App will continue without monitoring');

              // Update state to reflect disabled monitoring
              context.state.errorCount = consecutiveErrors;
              context.state.lastError = (error as Error).message;
            }
          }
        },

        onError(error) {
          console.error('[Monitoring] Error in middleware chain:', (error as Error).message);
          // Log to external service if not disabled
          if (!isDisabled) {
            console.log('📊 Error logged to monitoring service');
          }
        }
      });
    }
  };
}

export function errorRecoveryExample() {
  console.log('\n=== Example 5: Error Recovery Strategy ===\n');

  const store = createReactor<MonitoringState>(
    {
      operations: [],
      errorCount: 0,
      lastError: null
    },
    {
      plugins: [monitoringPlugin()]
    }
  );

  console.log('Making multiple updates to trigger errors...\n');

  // Make several updates (some will trigger errors)
  for (let i = 0; i < 10; i++) {
    store.update(state => {
      state.operations.push(`Operation ${i + 1}`);
    });
  }

  console.log('\n✅ All updates completed');
  console.log('Final state:', {
    operations: store.state.operations.length,
    errorCount: store.state.errorCount,
    hasError: !!store.state.lastError
  });

  store.destroy();
}

// =============================================================================
// Run all examples
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              PLUGIN & MIDDLEWARE ERROR HANDLING                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  safeMiddlewareExample();
  pluginInitializationExample();
  errorPropagationExample();
  await resilientPluginExample();
  errorRecoveryExample();

  console.log('\n✅ All plugin error examples completed!\n');
}
