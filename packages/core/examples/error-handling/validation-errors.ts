/**
 * Example: Validation Error Handling
 *
 * Demonstrates how to handle validation errors in svelte-reactor:
 * - Input validation with custom rules
 * - Throwing meaningful validation errors
 * - Catching and displaying errors to users
 * - Using validation plugin pattern
 */

import { createReactor } from '../../src/core/reactor.svelte';
import type { ReactorPlugin, PluginContext } from '../../src/types';

// =============================================================================
// Example 1: Basic Validation in Updates
// =============================================================================

interface UserState {
  name: string;
  age: number;
  email: string;
}

export function basicValidationExample() {
  console.log('\n=== Example 1: Basic Validation ===\n');

  const store = createReactor<UserState>({
    name: 'John Doe',
    age: 25,
    email: 'john@example.com'
  });

  // ❌ Try invalid update - will throw error
  try {
    store.update(state => {
      state.age = -5;  // Invalid age

      // Validate before accepting change
      if (state.age < 0 || state.age > 150) {
        throw new Error('[Validation] Age must be between 0 and 150');
      }
    });
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    console.log('✅ State unchanged:', store.state);
  }

  // ✅ Valid update - will succeed
  try {
    store.update(state => {
      state.age = 30;

      if (state.age < 0 || state.age > 150) {
        throw new Error('[Validation] Age must be between 0 and 150');
      }
    });
    console.log('✅ Valid update succeeded:', store.state);
  } catch (error) {
    console.error('Validation failed:', error);
  }

  store.destroy();
}

// =============================================================================
// Example 2: Validation Plugin Pattern
// =============================================================================

interface ValidationRule<T> {
  field: keyof T;
  validate: (value: any) => boolean;
  message: string;
}

function validationPlugin<T extends object>(
  rules: ValidationRule<T>[]
): ReactorPlugin<T> {
  return {
    name: 'validation',

    init(context) {
      // Validate initial state
      const errors: string[] = [];
      for (const rule of rules) {
        const value = context.state[rule.field];
        if (!rule.validate(value)) {
          errors.push(`${String(rule.field)}: ${rule.message}`);
        }
      }

      if (errors.length > 0) {
        console.warn('[Validation] Initial state has validation errors:', errors);
      }

      // Add middleware to validate on every update
      context.middlewares.push({
        name: 'validation-middleware',

        onBeforeUpdate(prevState, nextState, action) {
          const errors: string[] = [];

          for (const rule of rules) {
            const value = nextState[rule.field];
            if (!rule.validate(value)) {
              errors.push(`${String(rule.field)}: ${rule.message}`);
            }
          }

          if (errors.length > 0) {
            throw new Error(`[Validation] Update failed:\n  - ${errors.join('\n  - ')}`);
          }
        }
      });
    }
  };
}

export function validationPluginExample() {
  console.log('\n=== Example 2: Validation Plugin ===\n');

  const store = createReactor<UserState>(
    {
      name: 'Alice',
      age: 28,
      email: 'alice@example.com'
    },
    {
      plugins: [
        validationPlugin<UserState>([
          {
            field: 'name',
            validate: (value) => typeof value === 'string' && value.length >= 2,
            message: 'Name must be at least 2 characters'
          },
          {
            field: 'age',
            validate: (value) => typeof value === 'number' && value >= 0 && value <= 150,
            message: 'Age must be between 0 and 150'
          },
          {
            field: 'email',
            validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: 'Must be a valid email address'
          }
        ])
      ]
    }
  );

  console.log('Initial state:', store.state);

  // ❌ Try multiple invalid updates
  const invalidUpdates = [
    { field: 'name', value: 'A', description: 'Name too short' },
    { field: 'age', value: -10, description: 'Negative age' },
    { field: 'age', value: 200, description: 'Age too high' },
    { field: 'email', value: 'invalid-email', description: 'Invalid email format' }
  ];

  for (const update of invalidUpdates) {
    try {
      store.update(state => {
        (state as any)[update.field] = update.value;
      });
      console.log(`❌ ${update.description} - Should have thrown error!`);
    } catch (error) {
      console.log(`✅ ${update.description} - Caught:`, (error as Error).message.split('\n')[0]);
    }
  }

  // ✅ Valid updates
  console.log('\nTrying valid updates:');

  store.update(state => {
    state.name = 'Alice Smith';
  });
  console.log('✅ Name updated:', store.state.name);

  store.update(state => {
    state.age = 29;
  });
  console.log('✅ Age updated:', store.state.age);

  store.update(state => {
    state.email = 'alice.smith@example.com';
  });
  console.log('✅ Email updated:', store.state.email);

  console.log('\nFinal state:', store.state);

  store.destroy();
}

// =============================================================================
// Example 3: Multi-Field Validation
// =============================================================================

interface PasswordState {
  password: string;
  confirmPassword: string;
  username: string;
}

function crossFieldValidationPlugin(): ReactorPlugin<PasswordState> {
  return {
    name: 'cross-field-validation',

    init(context) {
      context.middlewares.push({
        name: 'password-match-validator',

        onBeforeUpdate(prevState, nextState) {
          // Check if passwords match (when both are set)
          if (nextState.password && nextState.confirmPassword) {
            if (nextState.password !== nextState.confirmPassword) {
              throw new Error('[Validation] Passwords do not match');
            }
          }

          // Check password strength
          if (nextState.password && nextState.password.length < 8) {
            throw new Error('[Validation] Password must be at least 8 characters');
          }

          // Check username is not in password
          if (nextState.password && nextState.username) {
            if (nextState.password.toLowerCase().includes(nextState.username.toLowerCase())) {
              throw new Error('[Validation] Password cannot contain username');
            }
          }
        }
      });
    }
  };
}

export function crossFieldValidationExample() {
  console.log('\n=== Example 3: Multi-Field Validation ===\n');

  const store = createReactor<PasswordState>(
    {
      password: '',
      confirmPassword: '',
      username: 'john'
    },
    {
      plugins: [crossFieldValidationPlugin()]
    }
  );

  // ❌ Password too short
  try {
    store.update(state => {
      state.password = 'weak';
    });
  } catch (error) {
    console.log('❌ Short password:', (error as Error).message);
  }

  // ❌ Passwords don't match
  try {
    store.update(state => {
      state.password = 'StrongPassword123';
      state.confirmPassword = 'DifferentPassword';
    });
  } catch (error) {
    console.log('❌ Mismatched passwords:', (error as Error).message);
  }

  // ❌ Password contains username
  try {
    store.update(state => {
      state.password = 'john12345';
    });
  } catch (error) {
    console.log('❌ Password contains username:', (error as Error).message);
  }

  // ✅ Valid password
  try {
    store.update(state => {
      state.password = 'StrongPassword123';
      state.confirmPassword = 'StrongPassword123';
    });
    console.log('✅ Valid password set successfully');
  } catch (error) {
    console.error('Validation failed:', error);
  }

  store.destroy();
}

// =============================================================================
// Example 4: Validation with Warnings (Non-Blocking)
// =============================================================================

interface FormState {
  title: string;
  content: string;
  tags: string[];
}

function validationWithWarningsPlugin(): ReactorPlugin<FormState> {
  return {
    name: 'validation-warnings',

    init(context) {
      context.middlewares.push({
        name: 'warning-validator',

        onAfterUpdate(prevState, nextState, action) {
          const warnings: string[] = [];

          // Warning: Title too short (but allow it)
          if (nextState.title.length > 0 && nextState.title.length < 5) {
            warnings.push('Title is very short (recommended: 5+ characters)');
          }

          // Warning: Content too short
          if (nextState.content.length > 0 && nextState.content.length < 20) {
            warnings.push('Content is too brief (recommended: 20+ characters)');
          }

          // Warning: No tags
          if (nextState.tags.length === 0) {
            warnings.push('Consider adding tags for better discoverability');
          }

          // Warning: Too many tags
          if (nextState.tags.length > 5) {
            warnings.push('Too many tags (recommended: 3-5 tags)');
          }

          if (warnings.length > 0) {
            console.warn('[Validation] Warnings for update:');
            warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
          }
        }
      });
    }
  };
}

export function validationWarningsExample() {
  console.log('\n=== Example 4: Validation with Warnings ===\n');

  const store = createReactor<FormState>(
    {
      title: '',
      content: '',
      tags: []
    },
    {
      plugins: [validationWithWarningsPlugin()]
    }
  );

  // Update with warnings (but still allowed)
  store.update(state => {
    state.title = 'Hi';  // Too short - warning
  });

  store.update(state => {
    state.content = 'Short text';  // Too short - warning
  });

  store.update(state => {
    state.tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];  // Too many - warning
  });

  // Update without warnings
  console.log('\nMaking valid updates:');
  store.update(state => {
    state.title = 'A Great Article Title';
    state.content = 'This is a well-written article with plenty of content that provides value to readers.';
    state.tags = ['javascript', 'svelte', 'tutorial'];
  });

  console.log('\n✅ Final state (no warnings):', store.state);

  store.destroy();
}

// =============================================================================
// Run all examples
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                 VALIDATION ERROR HANDLING                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  basicValidationExample();
  validationPluginExample();
  crossFieldValidationExample();
  validationWarningsExample();

  console.log('\n✅ All validation examples completed!\n');
}
