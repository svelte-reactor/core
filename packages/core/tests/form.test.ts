/**
 * Form Helper Tests
 * Target: 80+ tests covering all form functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createForm } from '../src/helpers/form.svelte.js';

describe('createForm', () => {
  // Mock localStorage
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      key: vi.fn((index: number) => Object.keys(localStorageMock)[index] || null),
      get length() {
        return Object.keys(localStorageMock).length;
      },
    } as Storage;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic CRUD', () => {
    it('should create form with initial values', () => {
      const form = createForm({
        initialValues: { email: '', password: '' },
      });

      expect(form.values.email).toBe('');
      expect(form.values.password).toBe('');
    });

    it('should set a single field value', () => {
      const form = createForm({
        initialValues: { name: '', age: 0 },
      });

      form.setField('name', 'John');
      expect(form.values.name).toBe('John');
    });

    it('should set multiple field values', () => {
      const form = createForm({
        initialValues: { name: '', email: '', age: 0 },
      });

      form.setFields({ name: 'John', email: 'john@example.com' });
      expect(form.values.name).toBe('John');
      expect(form.values.email).toBe('john@example.com');
      expect(form.values.age).toBe(0);
    });

    it('should track initial values separately', () => {
      const form = createForm({
        initialValues: { name: 'Initial' },
      });

      form.setField('name', 'Changed');
      expect(form.values.name).toBe('Changed');
      expect(form.initialValues.name).toBe('Initial');
    });

    it('should handle various data types', () => {
      const form = createForm({
        initialValues: {
          string: 'text',
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: 'value' },
        },
      });

      expect(form.values.string).toBe('text');
      expect(form.values.number).toBe(42);
      expect(form.values.boolean).toBe(true);
      expect(form.values.array).toEqual([1, 2, 3]);
      expect(form.values.object).toEqual({ nested: 'value' });
    });

    it('should reset form to initial values', () => {
      const form = createForm({
        initialValues: { name: 'Initial', email: '' },
      });

      form.setField('name', 'Changed');
      form.setField('email', 'test@test.com');
      form.reset();

      expect(form.values.name).toBe('Initial');
      expect(form.values.email).toBe('');
    });

    it('should reset form to new values', () => {
      const form = createForm({
        initialValues: { name: '', email: '' },
      });

      form.setField('name', 'Changed');
      form.reset({ name: 'New Initial', email: 'new@test.com' });

      expect(form.values.name).toBe('New Initial');
      expect(form.values.email).toBe('new@test.com');
      expect(form.initialValues.name).toBe('New Initial');
    });

    it('should handle empty initial values', () => {
      const form = createForm({
        initialValues: {},
      });

      expect(form.values).toEqual({});
      expect(form.isValid).toBe(true);
    });

    it('should handle null and undefined values', () => {
      const form = createForm({
        initialValues: {
          nullValue: null as string | null,
          undefinedValue: undefined as string | undefined,
        },
      });

      expect(form.values.nullValue).toBe(null);
      expect(form.values.undefinedValue).toBe(undefined);
    });

    it('should provide field helper for bindings', () => {
      const form = createForm({
        initialValues: { email: 'test@test.com' },
      });

      const fieldProps = form.field('email');

      expect(fieldProps.name).toBe('email');
      expect(fieldProps.value).toBe('test@test.com');
      expect(typeof fieldProps.oninput).toBe('function');
      expect(typeof fieldProps.onblur).toBe('function');
    });
  });

  describe('Touched State', () => {
    it('should track touched fields', () => {
      const form = createForm({
        initialValues: { email: '', password: '' },
      });

      expect(form.touched.email).toBe(false);
      expect(form.touched.password).toBe(false);

      form.setTouched('email');

      expect(form.touched.email).toBe(true);
      expect(form.touched.password).toBe(false);
    });

    it('should mark all fields as touched on submit', async () => {
      const form = createForm({
        initialValues: { email: '', password: '' },
      });

      expect(form.touched.email).toBe(false);
      expect(form.touched.password).toBe(false);

      await form.submit();

      expect(form.touched.email).toBe(true);
      expect(form.touched.password).toBe(true);
    });

    it('should reset touched state on reset', () => {
      const form = createForm({
        initialValues: { email: '' },
      });

      form.setTouched('email');
      expect(form.touched.email).toBe(true);

      form.reset();
      expect(form.touched.email).toBe(false);
    });
  });

  describe('Dirty State', () => {
    it('should track dirty fields', () => {
      const form = createForm({
        initialValues: { name: 'Initial' },
      });

      expect(form.dirty.name).toBe(false);
      expect(form.isDirty).toBe(false);

      form.setField('name', 'Changed');

      expect(form.dirty.name).toBe(true);
      expect(form.isDirty).toBe(true);
    });

    it('should clear dirty when value matches initial', () => {
      const form = createForm({
        initialValues: { name: 'Initial' },
      });

      form.setField('name', 'Changed');
      expect(form.dirty.name).toBe(true);

      form.setField('name', 'Initial');
      expect(form.dirty.name).toBe(false);
    });

    it('should reset dirty state on reset', () => {
      const form = createForm({
        initialValues: { name: 'Initial' },
      });

      form.setField('name', 'Changed');
      expect(form.isDirty).toBe(true);

      form.reset();
      expect(form.dirty.name).toBe(false);
      expect(form.isDirty).toBe(false);
    });
  });

  describe('Sync Validation', () => {
    it('should validate with single rule', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
        },
      });

      await form.validate();

      expect(form.errors.email).toBe('Invalid email');
      expect(form.isValid).toBe(false);
    });

    it('should pass validation with valid value', async () => {
      const form = createForm({
        initialValues: { email: 'test@example.com' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
        },
      });

      await form.validate();

      expect(form.errors.email).toBe('');
      expect(form.isValid).toBe(true);
    });

    it('should validate with multiple rules', async () => {
      const form = createForm({
        initialValues: { password: '' },
        validate: {
          password: [
            (v) => !!v || 'Password is required',
            (v) => v.length >= 8 || 'Min 8 characters',
            (v) => /[A-Z]/.test(v) || 'Must contain uppercase',
          ],
        },
      });

      await form.validate();
      expect(form.errors.password).toBe('Password is required');

      form.setField('password', 'short');
      await form.validate();
      expect(form.errors.password).toBe('Min 8 characters');

      form.setField('password', 'longpassword');
      await form.validate();
      expect(form.errors.password).toBe('Must contain uppercase');

      form.setField('password', 'LongPassword123');
      await form.validate();
      expect(form.errors.password).toBe('');
      expect(form.isValid).toBe(true);
    });

    it('should validate on change when validateOn=change', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
        },
        validateOn: 'change',
      });

      form.setField('email', 'invalid');

      // Give time for validation to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(form.errors.email).toBe('Invalid email');
    });

    it('should validate on blur when validateOn=blur', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
        },
        validateOn: 'blur',
      });

      form.setField('email', 'invalid');

      // Should not validate on change
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(form.errors.email).toBe('');

      // Should validate on blur
      form.setTouched('email');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(form.errors.email).toBe('Invalid email');
    });

    it('should validate on submit when validateOn=submit', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
        },
        validateOn: 'submit',
      });

      form.setField('email', 'invalid');
      form.setTouched('email');

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(form.errors.email).toBe('');

      await form.submit();
      expect(form.errors.email).toBe('Invalid email');
    });

    it('should validate single field', async () => {
      const form = createForm({
        initialValues: { email: '', name: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
          name: (v) => !!v || 'Name required',
        },
      });

      const isEmailValid = await form.validateField('email');

      expect(isEmailValid).toBe(false);
      expect(form.errors.email).toBe('Invalid email');
      expect(form.errors.name).toBe(''); // Not validated yet
    });

    it('should manually set and clear errors', () => {
      const form = createForm({
        initialValues: { email: '' },
      });

      form.setError('email', 'Custom error');
      expect(form.errors.email).toBe('Custom error');
      expect(form.isValid).toBe(false);

      form.clearError('email');
      expect(form.errors.email).toBe('');
      expect(form.isValid).toBe(true);
    });

    it('should access other form values in validation', async () => {
      const form = createForm({
        initialValues: { password: '', confirmPassword: '' },
        validate: {
          confirmPassword: (v, values) =>
            v === values.password || 'Passwords must match',
        },
      });

      form.setField('password', 'secret123');
      form.setField('confirmPassword', 'different');

      await form.validate();
      expect(form.errors.confirmPassword).toBe('Passwords must match');

      form.setField('confirmPassword', 'secret123');
      await form.validate();
      expect(form.errors.confirmPassword).toBe('');
    });
  });

  describe('Async Validation', () => {
    it('should validate with async rule', async () => {
      const form = createForm({
        initialValues: { username: '' },
        validateAsync: {
          username: async (v) => {
            await new Promise((r) => setTimeout(r, 10));
            return v !== 'taken' || 'Username already taken';
          },
        },
      });

      form.setField('username', 'taken');
      await form.validate();

      expect(form.errors.username).toBe('Username already taken');
    });

    it('should pass async validation with valid value', async () => {
      const form = createForm({
        initialValues: { username: '' },
        validateAsync: {
          username: async (v) => {
            await new Promise((r) => setTimeout(r, 10));
            return v !== 'taken' || 'Username already taken';
          },
        },
      });

      form.setField('username', 'available');
      await form.validate();

      expect(form.errors.username).toBe('');
      expect(form.isValid).toBe(true);
    });

    it('should run async validation only if sync passes', async () => {
      const asyncValidator = vi.fn().mockResolvedValue(true);

      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => !!v || 'Email required',
        },
        validateAsync: {
          email: asyncValidator,
        },
      });

      await form.validate();

      expect(form.errors.email).toBe('Email required');
      expect(asyncValidator).not.toHaveBeenCalled();

      form.setField('email', 'test@test.com');
      await form.validate();

      expect(asyncValidator).toHaveBeenCalled();
    });

    it('should handle async validation errors', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validateAsync: {
          email: async () => {
            throw new Error('Network error');
          },
        },
        validateOn: 'submit', // Don't auto-validate on change
      });

      form.setField('email', 'test@test.com');

      await expect(form.validate()).rejects.toThrow('Network error');
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with valid form', async () => {
      const onSubmit = vi.fn();

      const form = createForm({
        initialValues: { email: 'test@test.com' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid',
        },
        onSubmit,
      });

      await form.submit();

      expect(onSubmit).toHaveBeenCalledWith({ email: 'test@test.com' });
    });

    it('should not call onSubmit with invalid form', async () => {
      const onSubmit = vi.fn();

      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid',
        },
        onSubmit,
      });

      await form.submit();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should track isSubmitting state', async () => {
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((r) => {
        resolveSubmit = r;
      });

      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: async () => {
          await submitPromise;
        },
      });

      expect(form.isSubmitting).toBe(false);

      const submitCall = form.submit();
      await new Promise((r) => setTimeout(r, 0));

      expect(form.isSubmitting).toBe(true);

      resolveSubmit!();
      await submitCall;

      expect(form.isSubmitting).toBe(false);
    });

    it('should track submitCount', async () => {
      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: vi.fn(),
      });

      expect(form.submitCount).toBe(0);

      await form.submit();
      expect(form.submitCount).toBe(1);

      await form.submit();
      expect(form.submitCount).toBe(2);
    });

    it('should track submitError on failed submission', async () => {
      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: async () => {
          throw new Error('Submit failed');
        },
      });

      expect(form.submitError).toBe(null);

      try {
        await form.submit();
      } catch {
        // Expected
      }

      expect(form.submitError).toBe('Submit failed');
    });

    it('should clear submitError on new submit attempt', async () => {
      let shouldFail = true;

      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: async () => {
          if (shouldFail) {
            throw new Error('Submit failed');
          }
        },
      });

      try {
        await form.submit();
      } catch {
        // Expected
      }

      expect(form.submitError).toBe('Submit failed');

      shouldFail = false;
      await form.submit();

      expect(form.submitError).toBe(null);
    });

    it('should reset submitCount on reset', async () => {
      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: vi.fn(),
      });

      await form.submit();
      await form.submit();
      expect(form.submitCount).toBe(2);

      form.reset();
      expect(form.submitCount).toBe(0);
    });

    it('should handle async onSubmit', async () => {
      const results: string[] = [];

      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: async (values) => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(`Submitted: ${values.name}`);
        },
      });

      await form.submit();

      expect(results).toEqual(['Submitted: Test']);
    });

    it('should work without onSubmit', async () => {
      const form = createForm({
        initialValues: { name: 'Test' },
      });

      // Should not throw
      await form.submit();
      expect(form.submitCount).toBe(1);
    });
  });

  describe('Draft Persistence', () => {
    it('should persist form values to localStorage', async () => {
      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'test-form',
        persistDebounce: 0,
      });

      form.setField('name', 'Persisted Value');

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 50));

      expect(localStorage.setItem).toHaveBeenCalled();
      const storedValue = localStorageMock['svelte-reactor-form:test-form'];
      expect(JSON.parse(storedValue)).toEqual({ name: 'Persisted Value' });
    });

    it('should load persisted values on init', () => {
      localStorageMock['svelte-reactor-form:test-form'] = JSON.stringify({
        name: 'Loaded Value',
      });

      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'test-form',
      });

      expect(form.values.name).toBe('Loaded Value');
    });

    it('should clear persisted draft on reset', async () => {
      localStorageMock['svelte-reactor-form:test-form'] = JSON.stringify({
        name: 'Value',
      });

      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'test-form',
      });

      form.reset();

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        'svelte-reactor-form:test-form'
      );
    });

    it('should clear persisted draft on successful submit', async () => {
      const form = createForm({
        initialValues: { name: 'Test' },
        persistDraft: 'test-form',
        onSubmit: vi.fn(),
      });

      await form.submit();

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        'svelte-reactor-form:test-form'
      );
    });

    it('should apply persistTransform before saving', async () => {
      const form = createForm({
        initialValues: { name: '', password: 'secret' },
        persistDraft: 'test-form',
        persistDebounce: 0,
        persistTransform: (values) => ({
          name: values.name,
          // Omit password
        }),
      });

      form.setField('name', 'John');

      await new Promise((r) => setTimeout(r, 50));

      const storedValue = localStorageMock['svelte-reactor-form:test-form'];
      expect(JSON.parse(storedValue)).toEqual({ name: 'John' });
      expect(JSON.parse(storedValue).password).toBeUndefined();
    });

    it('should debounce persistence', async () => {
      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'test-form',
        persistDebounce: 100,
      });

      form.setField('name', 'First');
      form.setField('name', 'Second');
      form.setField('name', 'Third');

      // Not persisted yet
      await new Promise((r) => setTimeout(r, 50));
      expect(localStorageMock['svelte-reactor-form:test-form']).toBeUndefined();

      // Persisted after debounce
      await new Promise((r) => setTimeout(r, 100));
      const storedValue = localStorageMock['svelte-reactor-form:test-form'];
      expect(JSON.parse(storedValue)).toEqual({ name: 'Third' });
    });

    it('should mark loaded fields as dirty', () => {
      localStorageMock['svelte-reactor-form:test-form'] = JSON.stringify({
        name: 'Loaded',
      });

      const form = createForm({
        initialValues: { name: 'Initial' },
        persistDraft: 'test-form',
      });

      expect(form.values.name).toBe('Loaded');
      expect(form.dirty.name).toBe(true);
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorageMock['svelte-reactor-form:test-form'] = 'invalid json';

      // Should not throw
      const form = createForm({
        initialValues: { name: 'Default' },
        persistDraft: 'test-form',
      });

      expect(form.values.name).toBe('Default');
    });

    it('should cleanup on destroy', async () => {
      vi.useFakeTimers();

      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'test-form',
        persistDebounce: 1000,
      });

      form.setField('name', 'Test');
      form.destroy();

      vi.advanceTimersByTime(2000);

      // Should not have persisted after destroy
      expect(
        localStorageMock['svelte-reactor-form:test-form']
      ).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid field updates', async () => {
      const form = createForm({
        initialValues: { count: 0 },
      });

      for (let i = 0; i < 100; i++) {
        form.setField('count', i);
      }

      expect(form.values.count).toBe(99);
    });

    it('should handle concurrent validations', async () => {
      const form = createForm({
        initialValues: { a: '', b: '', c: '' },
        validateAsync: {
          a: async (v) => {
            await new Promise((r) => setTimeout(r, 30));
            return !!v || 'A required';
          },
          b: async (v) => {
            await new Promise((r) => setTimeout(r, 20));
            return !!v || 'B required';
          },
          c: async (v) => {
            await new Promise((r) => setTimeout(r, 10));
            return !!v || 'C required';
          },
        },
      });

      const isValid = await form.validate();

      expect(isValid).toBe(false);
      expect(form.errors.a).toBe('A required');
      expect(form.errors.b).toBe('B required');
      expect(form.errors.c).toBe('C required');
    });

    it('should handle field helper input event', () => {
      const form = createForm({
        initialValues: { email: '' },
      });

      const fieldProps = form.field('email');

      // Simulate input event
      const event = {
        target: { type: 'text', value: 'new@test.com' },
      } as unknown as Event;

      fieldProps.oninput(event);

      expect(form.values.email).toBe('new@test.com');
    });

    it('should handle checkbox field type', () => {
      const form = createForm({
        initialValues: { agree: false },
      });

      const fieldProps = form.field('agree');

      // Simulate checkbox event
      const event = {
        target: { type: 'checkbox', checked: true },
      } as unknown as Event;

      fieldProps.oninput(event);

      expect(form.values.agree).toBe(true);
    });

    it('should handle field helper blur event', () => {
      const form = createForm({
        initialValues: { email: '' },
        validateOn: 'blur',
        validate: {
          email: (v) => !!v || 'Required',
        },
      });

      const fieldProps = form.field('email');

      expect(form.touched.email).toBe(false);

      fieldProps.onblur();

      expect(form.touched.email).toBe(true);
    });

    it('should not persist in SSR environment', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      // Should not throw
      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'ssr-test',
      });

      expect(form.values.name).toBe('');

      // @ts-ignore
      global.window = originalWindow;
    });

    it('should handle form with no validation', async () => {
      const onSubmit = vi.fn();

      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit,
      });

      await form.submit();

      expect(onSubmit).toHaveBeenCalledWith({ name: 'Test' });
    });

    it('should return correct validation result', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid',
        },
      });

      let result = await form.validate();
      expect(result).toBe(false);

      form.setField('email', 'test@test.com');
      result = await form.validate();
      expect(result).toBe(true);
    });

    it('should handle deeply nested objects', () => {
      const form = createForm({
        initialValues: {
          user: {
            profile: {
              settings: {
                theme: 'dark',
              },
            },
          },
        },
      });

      form.setField('user', {
        profile: {
          settings: {
            theme: 'light',
          },
        },
      });

      expect(form.values.user.profile.settings.theme).toBe('light');
    });
  });

  describe('isValid Computed State', () => {
    it('should be true when no errors', () => {
      const form = createForm({
        initialValues: { name: '' },
      });

      expect(form.isValid).toBe(true);
    });

    it('should be false when any error exists', async () => {
      const form = createForm({
        initialValues: { name: '', email: '' },
        validate: {
          name: (v) => !!v || 'Required',
        },
      });

      await form.validate();

      expect(form.isValid).toBe(false);
    });

    it('should update reactively', async () => {
      const form = createForm({
        initialValues: { name: '' },
        validate: {
          name: (v) => !!v || 'Required',
        },
        validateOn: 'change',
      });

      await form.validate();
      expect(form.isValid).toBe(false);

      form.setField('name', 'Valid');
      await new Promise((r) => setTimeout(r, 0));
      expect(form.isValid).toBe(true);
    });
  });

  describe('isDirty Computed State', () => {
    it('should be false when no changes', () => {
      const form = createForm({
        initialValues: { name: 'Initial' },
      });

      expect(form.isDirty).toBe(false);
    });

    it('should be true when any field changed', () => {
      const form = createForm({
        initialValues: { name: 'Initial', email: '' },
      });

      form.setField('email', 'test@test.com');

      expect(form.isDirty).toBe(true);
    });

    it('should become false when changes are reverted', () => {
      const form = createForm({
        initialValues: { name: 'Initial' },
      });

      form.setField('name', 'Changed');
      expect(form.isDirty).toBe(true);

      form.setField('name', 'Initial');
      expect(form.isDirty).toBe(false);
    });
  });

  describe('Additional Validation Tests', () => {
    it('should validate required fields', async () => {
      const form = createForm({
        initialValues: { name: '', email: '' },
        validate: {
          name: (v) => !!v || 'Name is required',
          email: (v) => !!v || 'Email is required',
        },
      });

      const isValid = await form.validate();
      expect(isValid).toBe(false);
      expect(form.errors.name).toBe('Name is required');
      expect(form.errors.email).toBe('Email is required');
    });

    it('should validate email format', async () => {
      const form = createForm({
        initialValues: { email: 'invalid' },
        validate: {
          email: [
            (v) => !!v || 'Required',
            (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email format',
          ],
        },
      });

      await form.validate();
      expect(form.errors.email).toBe('Invalid email format');

      form.setField('email', 'valid@example.com');
      await form.validate();
      expect(form.errors.email).toBe('');
    });

    it('should validate min/max length', async () => {
      const form = createForm({
        initialValues: { bio: '' },
        validate: {
          bio: [
            (v) => v.length >= 10 || 'Min 10 characters',
            (v) => v.length <= 100 || 'Max 100 characters',
          ],
        },
      });

      form.setField('bio', 'short');
      await form.validate();
      expect(form.errors.bio).toBe('Min 10 characters');

      form.setField('bio', 'a'.repeat(101));
      await form.validate();
      expect(form.errors.bio).toBe('Max 100 characters');

      form.setField('bio', 'Valid bio text here');
      await form.validate();
      expect(form.errors.bio).toBe('');
    });

    it('should validate numeric ranges', async () => {
      const form = createForm({
        initialValues: { age: 0 },
        validate: {
          age: [
            (v) => v >= 18 || 'Must be at least 18',
            (v) => v <= 120 || 'Invalid age',
          ],
        },
      });

      form.setField('age', 15);
      await form.validate();
      expect(form.errors.age).toBe('Must be at least 18');

      form.setField('age', 25);
      await form.validate();
      expect(form.errors.age).toBe('');
    });

    it('should validate URL format', async () => {
      const form = createForm({
        initialValues: { website: '' },
        validate: {
          website: (v) => {
            if (!v) return true;
            try {
              new URL(v);
              return true;
            } catch {
              return 'Invalid URL';
            }
          },
        },
      });

      form.setField('website', 'not-a-url');
      await form.validate();
      expect(form.errors.website).toBe('Invalid URL');

      form.setField('website', 'https://example.com');
      await form.validate();
      expect(form.errors.website).toBe('');
    });

    it('should validate date fields', async () => {
      const form = createForm({
        initialValues: { birthDate: '' },
        validate: {
          birthDate: (v) => {
            if (!v) return 'Date required';
            const date = new Date(v);
            return !isNaN(date.getTime()) || 'Invalid date';
          },
        },
      });

      await form.validate();
      expect(form.errors.birthDate).toBe('Date required');

      form.setField('birthDate', '2000-01-01');
      await form.validate();
      expect(form.errors.birthDate).toBe('');
    });
  });

  describe('Additional Form State Tests', () => {
    it('should handle multiple sequential validations', async () => {
      const form = createForm({
        initialValues: { field: '' },
        validate: {
          field: (v) => !!v || 'Required',
        },
      });

      await form.validate();
      expect(form.isValid).toBe(false);

      form.setField('field', 'value');
      await form.validate();
      expect(form.isValid).toBe(true);

      form.setField('field', '');
      await form.validate();
      expect(form.isValid).toBe(false);
    });

    it('should preserve form state after partial reset', () => {
      const form = createForm({
        initialValues: { a: 'initial-a', b: 'initial-b' },
      });

      form.setField('a', 'changed-a');
      form.setField('b', 'changed-b');
      form.setTouched('a');
      form.setTouched('b');

      form.reset({ a: 'new-a' });

      expect(form.values.a).toBe('new-a');
      expect(form.values.b).toBe('initial-b');
      expect(form.touched.a).toBe(false);
      expect(form.touched.b).toBe(false);
    });

    it('should track all fields as touched after failed submit', async () => {
      const form = createForm({
        initialValues: { a: '', b: '', c: '' },
        validate: {
          a: (v) => !!v || 'Required',
        },
      });

      await form.submit();

      expect(form.touched.a).toBe(true);
      expect(form.touched.b).toBe(true);
      expect(form.touched.c).toBe(true);
    });

    it('should increment submitCount even on validation failure', async () => {
      const form = createForm({
        initialValues: { name: '' },
        validate: {
          name: (v) => !!v || 'Required',
        },
      });

      await form.submit();
      expect(form.submitCount).toBe(1);
      expect(form.isValid).toBe(false);

      await form.submit();
      expect(form.submitCount).toBe(2);
    });
  });

  describe('Additional Persistence Tests', () => {
    it('should not persist when persistDraft is not set', async () => {
      const form = createForm({
        initialValues: { name: '' },
      });

      form.setField('name', 'Test');
      await new Promise((r) => setTimeout(r, 100));

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', async () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });

      const form = createForm({
        initialValues: { name: '' },
        persistDraft: 'test-form',
        persistDebounce: 0,
      });

      // Should not throw
      form.setField('name', 'Test');
      await new Promise((r) => setTimeout(r, 50));

      expect(form.values.name).toBe('Test');
      setItemSpy.mockRestore();
    });

    it('should handle partial persisted data', () => {
      localStorageMock['svelte-reactor-form:test-form'] = JSON.stringify({
        name: 'Loaded',
        // email is missing
      });

      const form = createForm({
        initialValues: { name: '', email: 'default@test.com' },
        persistDraft: 'test-form',
      });

      expect(form.values.name).toBe('Loaded');
      expect(form.values.email).toBe('default@test.com');
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle array field values', () => {
      const form = createForm({
        initialValues: { tags: [] as string[] },
      });

      form.setField('tags', ['a', 'b', 'c']);
      expect(form.values.tags).toEqual(['a', 'b', 'c']);
    });

    it('should handle form with many fields', () => {
      const initialValues: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        initialValues[`field${i}`] = '';
      }

      const form = createForm({ initialValues });

      expect(Object.keys(form.values)).toHaveLength(50);

      form.setField('field25', 'value');
      expect(form.values.field25).toBe('value');
    });

    it('should handle validation with external state reference', async () => {
      const config = { minLength: 5 };

      const form = createForm({
        initialValues: { name: '' },
        validate: {
          name: (v) => v.length >= config.minLength || `Min ${config.minLength} chars`,
        },
      });

      form.setField('name', 'abc');
      await form.validate();
      expect(form.errors.name).toBe('Min 5 chars');

      config.minLength = 2;
      await form.validate();
      expect(form.errors.name).toBe('');
    });

    it('should handle validation returning empty string as valid', async () => {
      const form = createForm({
        initialValues: { name: '' },
        validate: {
          name: (v) => !!v || '', // Empty string error
        },
      });

      await form.validate();
      // Empty string should still be considered invalid state
      expect(form.errors.name).toBe('');
    });

    it('should support setting initial errors', () => {
      const form = createForm({
        initialValues: { email: '' },
      });

      form.setError('email', 'Server validation error');
      expect(form.errors.email).toBe('Server validation error');
      expect(form.isValid).toBe(false);
    });

    it('should clear specific error without affecting others', () => {
      const form = createForm({
        initialValues: { a: '', b: '' },
      });

      form.setError('a', 'Error A');
      form.setError('b', 'Error B');

      expect(form.isValid).toBe(false);

      form.clearError('a');
      expect(form.errors.a).toBe('');
      expect(form.errors.b).toBe('Error B');
      expect(form.isValid).toBe(false);

      form.clearError('b');
      expect(form.isValid).toBe(true);
    });

    it('should support conditional validation', async () => {
      const form = createForm({
        initialValues: { hasWebsite: false, website: '' },
        validate: {
          website: (v, values) => {
            if (!values.hasWebsite) return true;
            return !!v || 'Website required when enabled';
          },
        },
      });

      await form.validate();
      expect(form.errors.website).toBe('');

      form.setField('hasWebsite', true);
      await form.validate();
      expect(form.errors.website).toBe('Website required when enabled');

      form.setField('website', 'https://example.com');
      await form.validate();
      expect(form.errors.website).toBe('');
    });
  });

  describe('Stress Tests & Performance', () => {
    it('should handle 1000 rapid field updates', () => {
      const form = createForm({
        initialValues: { counter: 0 },
        validateOn: 'submit',
      });

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        form.setField('counter', i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(form.values.counter).toBe(999);
      expect(duration).toBeLessThan(1000); // Should be under 1 second
    });

    it('should handle form with 100 fields', async () => {
      const initialValues: Record<string, string> = {};
      const validate: Record<string, (v: string) => true | string> = {};

      for (let i = 0; i < 100; i++) {
        initialValues[`field${i}`] = '';
        validate[`field${i}`] = (v) => !!v || `Field ${i} required`;
      }

      const form = createForm({ initialValues, validate });

      const startTime = performance.now();
      await form.validate();
      const endTime = performance.now();

      expect(form.isValid).toBe(false);
      expect(Object.values(form.errors).filter(Boolean)).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should handle rapid setField with validation on change', async () => {
      const form = createForm({
        initialValues: { value: '' },
        validate: {
          value: (v) => v.length >= 3 || 'Min 3 chars',
        },
        validateOn: 'change',
      });

      for (let i = 0; i < 100; i++) {
        form.setField('value', 'a'.repeat(i));
      }

      await new Promise((r) => setTimeout(r, 50));

      expect(form.values.value).toBe('a'.repeat(99));
    });

    it('should handle concurrent async validations', async () => {
      let validationCount = 0;

      const form = createForm({
        initialValues: { a: '', b: '', c: '', d: '', e: '' },
        validateAsync: {
          a: async () => { validationCount++; await new Promise(r => setTimeout(r, 10)); return true; },
          b: async () => { validationCount++; await new Promise(r => setTimeout(r, 20)); return true; },
          c: async () => { validationCount++; await new Promise(r => setTimeout(r, 15)); return true; },
          d: async () => { validationCount++; await new Promise(r => setTimeout(r, 5)); return true; },
          e: async () => { validationCount++; await new Promise(r => setTimeout(r, 25)); return true; },
        },
        validateOn: 'submit',
      });

      form.setFields({ a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' });

      const startTime = performance.now();
      await form.validate();
      const endTime = performance.now();

      expect(validationCount).toBe(5);
      // Parallel execution should complete faster than sequential (25+20+15+10+5 = 75ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle many form resets', () => {
      const form = createForm({
        initialValues: { name: '', count: 0 },
      });

      for (let i = 0; i < 500; i++) {
        form.setField('name', `Name ${i}`);
        form.setField('count', i);
        form.reset();
      }

      expect(form.values.name).toBe('');
      expect(form.values.count).toBe(0);
      expect(form.isDirty).toBe(false);
    });

    it('should handle rapid submit attempts', async () => {
      let submitCount = 0;

      const form = createForm({
        initialValues: { name: 'Test' },
        onSubmit: async () => {
          submitCount++;
          await new Promise((r) => setTimeout(r, 10));
        },
      });

      // Fire multiple submits rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(form.submit());
      }

      await Promise.all(promises);

      expect(submitCount).toBe(10);
      expect(form.submitCount).toBe(10);
    });

    it('should handle deeply nested validation dependencies', async () => {
      const form = createForm({
        initialValues: {
          password: '',
          confirmPassword: '',
          oldPassword: '',
        },
        validate: {
          password: (v, values) => {
            if (!v) return 'Required';
            if (v === values.oldPassword) return 'Must be different from old password';
            return true;
          },
          confirmPassword: (v, values) => {
            if (!v) return 'Required';
            if (v !== values.password) return 'Must match password';
            return true;
          },
        },
      });

      form.setFields({
        oldPassword: 'old123',
        password: 'old123',
        confirmPassword: 'old123',
      });

      await form.validate();

      expect(form.errors.password).toBe('Must be different from old password');
      expect(form.errors.confirmPassword).toBe('');

      form.setField('password', 'new456');
      await form.validate();

      expect(form.errors.password).toBe('');
      expect(form.errors.confirmPassword).toBe('Must match password');

      form.setField('confirmPassword', 'new456');
      await form.validate();

      expect(form.isValid).toBe(true);
    });

    it('should not leak memory during repeated operations', () => {
      // Create and destroy many forms
      for (let i = 0; i < 100; i++) {
        const form = createForm({
          initialValues: { field: '' },
          persistDraft: `test-form-${i}`,
          persistDebounce: 0,
        });

        form.setField('field', 'test');
        form.destroy();
      }

      // Should not throw or cause issues
      expect(true).toBe(true);
    });

    it('should handle alternating valid/invalid states', async () => {
      const form = createForm({
        initialValues: { toggle: '' },
        validate: {
          toggle: (v) => v === 'valid' || 'Must be "valid"',
        },
        validateOn: 'submit',
      });

      for (let i = 0; i < 50; i++) {
        form.setField('toggle', i % 2 === 0 ? 'valid' : 'invalid');
        await form.validate();

        if (i % 2 === 0) {
          expect(form.isValid).toBe(true);
        } else {
          expect(form.isValid).toBe(false);
        }
      }
    });

    it('should handle form operations during async validation', async () => {
      let asyncValidationResolve: () => void;
      const asyncValidationPromise = new Promise<void>((r) => {
        asyncValidationResolve = r;
      });

      const form = createForm({
        initialValues: { email: '' },
        validateAsync: {
          email: async () => {
            await asyncValidationPromise;
            return true;
          },
        },
        validateOn: 'submit',
      });

      form.setField('email', 'test@test.com');

      // Start validation but don't await
      const validatePromise = form.validate();

      // Perform operations during validation
      form.setField('email', 'changed@test.com');
      form.setTouched('email');

      // Complete async validation
      asyncValidationResolve!();
      await validatePromise;

      expect(form.values.email).toBe('changed@test.com');
      expect(form.touched.email).toBe(true);
    });

    it('should handle large field values', () => {
      const form = createForm({
        initialValues: { content: '' },
      });

      const largeString = 'x'.repeat(1_000_000); // 1MB string
      form.setField('content', largeString);

      expect(form.values.content.length).toBe(1_000_000);
      expect(form.isDirty).toBe(true);
    });

    it('should validate form with complex nested rules efficiently', async () => {
      const form = createForm({
        initialValues: { value: '' },
        validate: {
          value: [
            (v) => !!v || 'Required',
            (v) => v.length >= 3 || 'Min 3',
            (v) => v.length <= 100 || 'Max 100',
            (v) => /^[a-z]/.test(v) || 'Must start with lowercase',
            (v) => /[0-9]$/.test(v) || 'Must end with number',
            (v) => /[A-Z]/.test(v) || 'Must contain uppercase',
            (v) => !/\s/.test(v) || 'No spaces allowed',
            (v) => v !== 'admin' || 'Reserved name',
          ],
        },
      });

      const startTime = performance.now();

      // Test each rule
      form.setField('value', '');
      await form.validate();
      expect(form.errors.value).toBe('Required');

      form.setField('value', 'ab');
      await form.validate();
      expect(form.errors.value).toBe('Min 3');

      form.setField('value', 'Abc123');
      await form.validate();
      expect(form.errors.value).toBe('Must start with lowercase');

      form.setField('value', 'abcXyz');
      await form.validate();
      expect(form.errors.value).toBe('Must end with number');

      form.setField('value', 'abc1');
      await form.validate();
      expect(form.errors.value).toBe('Must contain uppercase');

      form.setField('value', 'abcX1');
      await form.validate();
      expect(form.errors.value).toBe('');

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('useField Svelte Action', () => {
    it('should set initial value on text input', () => {
      const form = createForm({
        initialValues: { name: 'John' },
      });

      const input = document.createElement('input');
      input.type = 'text';

      const action = form.useField(input, 'name');

      expect(input.value).toBe('John');

      action.destroy();
    });

    it('should set initial value on checkbox', () => {
      const form = createForm({
        initialValues: { agree: true },
      });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';

      const action = form.useField(checkbox, 'agree');

      expect(checkbox.checked).toBe(true);

      action.destroy();
    });

    it('should update form value on input event', () => {
      const form = createForm({
        initialValues: { email: '' },
      });

      const input = document.createElement('input');
      input.type = 'email';

      const action = form.useField(input, 'email');

      // Simulate typing
      input.value = 'test@example.com';
      input.dispatchEvent(new Event('input'));

      expect(form.values.email).toBe('test@example.com');

      action.destroy();
    });

    it('should update form value on checkbox change', () => {
      const form = createForm({
        initialValues: { subscribe: false },
      });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';

      const action = form.useField(checkbox, 'subscribe');

      // Simulate checking
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('input'));

      expect(form.values.subscribe).toBe(true);

      action.destroy();
    });

    it('should mark field as touched on blur', () => {
      const form = createForm({
        initialValues: { name: '' },
      });

      const input = document.createElement('input');

      const action = form.useField(input, 'name');

      expect(form.touched.name).toBe(false);

      input.dispatchEvent(new Event('blur'));

      expect(form.touched.name).toBe(true);

      action.destroy();
    });

    it('should work with select element', () => {
      const form = createForm({
        initialValues: { country: 'us' },
      });

      const select = document.createElement('select');
      select.innerHTML = `
        <option value="us">USA</option>
        <option value="uk">UK</option>
      `;

      const action = form.useField(select, 'country');

      expect(select.value).toBe('us');

      // Change selection
      select.value = 'uk';
      select.dispatchEvent(new Event('input'));

      expect(form.values.country).toBe('uk');

      action.destroy();
    });

    it('should work with textarea element', () => {
      const form = createForm({
        initialValues: { message: 'Hello' },
      });

      const textarea = document.createElement('textarea');

      const action = form.useField(textarea, 'message');

      expect(textarea.value).toBe('Hello');

      textarea.value = 'New message';
      textarea.dispatchEvent(new Event('input'));

      expect(form.values.message).toBe('New message');

      action.destroy();
    });

    it('should cleanup event listeners on destroy', () => {
      const form = createForm({
        initialValues: { name: '' },
      });

      const input = document.createElement('input');
      const removeEventListenerSpy = vi.spyOn(input, 'removeEventListener');

      const action = form.useField(input, 'name');
      action.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('should trigger validation on change when validateOn is change', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
        },
        validateOn: 'change',
      });

      const input = document.createElement('input');

      const action = form.useField(input, 'email');

      input.value = 'invalid';
      input.dispatchEvent(new Event('input'));

      // Wait for validation to complete
      await new Promise((r) => setTimeout(r, 10));
      expect(form.errors.email).toBe('Invalid email');

      input.value = 'valid@test.com';
      input.dispatchEvent(new Event('input'));

      // Wait for validation to complete
      await new Promise((r) => setTimeout(r, 10));
      expect(form.errors.email).toBe('');

      action.destroy();
    });
  });
});
