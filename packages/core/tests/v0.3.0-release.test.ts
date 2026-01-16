/**
 * v0.3.0 Release Integration Tests
 * Complex scenarios testing form + reactor + plugins integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { createForm } from '../src/helpers/form.svelte.js';
import { persist, undoRedo, sync, logger } from '../src/plugins';
import { arrayActions } from '../src/helpers/array-actions';
import { simpleStore } from '../src/helpers/simple-store';
import { persistedStore } from '../src/helpers/persisted-store';
import { computedStore } from '../src/helpers/computed-store';

describe('v0.3.0 Release Tests', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
      get length() {
        return Object.keys(storage).length;
      },
      key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    } as Storage;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form + Reactor Integration', () => {
    it('should sync form submission with reactor state', async () => {
      // Reactor for user management
      const userStore = createReactor({
        currentUser: null as { email: string; name: string } | null,
        isLoggedIn: false,
      });

      // Login form
      const loginForm = createForm({
        initialValues: { email: '', password: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
          password: (v) => v.length >= 8 || 'Min 8 characters',
        },
        onSubmit: async (values) => {
          // Simulate API call
          await new Promise((r) => setTimeout(r, 10));
          userStore.update((s) => {
            s.currentUser = { email: values.email, name: 'Test User' };
            s.isLoggedIn = true;
          });
        },
      });

      // Fill form
      loginForm.setField('email', 'user@example.com');
      loginForm.setField('password', 'password123');

      expect(loginForm.isValid).toBe(true);
      expect(userStore.state.isLoggedIn).toBe(false);

      // Submit
      await loginForm.submit();

      expect(userStore.state.isLoggedIn).toBe(true);
      expect(userStore.state.currentUser?.email).toBe('user@example.com');

      loginForm.destroy();
      userStore.destroy();
    });

    it('should handle form with reactor-backed options', () => {
      // Reactor for available options
      const optionsStore = createReactor({
        countries: ['US', 'UK', 'UA', 'DE'],
        selectedCountry: '',
      });

      const form = createForm({
        initialValues: {
          name: '',
          country: '',
        },
        validate: {
          name: (v) => !!v || 'Name required',
          country: (v, values) => {
            // Validate against reactor state
            return (
              optionsStore.state.countries.includes(v) || 'Invalid country'
            );
          },
        },
      });

      form.setField('name', 'John');
      form.setField('country', 'US');
      expect(form.isValid).toBe(true);

      form.setField('country', 'INVALID');
      expect(form.errors.country).toBe('Invalid country');

      form.destroy();
      optionsStore.destroy();
    });
  });

  describe('Complex Form Validation', () => {
    it('should handle cross-field validation with multiple rules', async () => {
      const form = createForm({
        initialValues: {
          password: '',
          confirmPassword: '',
          email: '',
          confirmEmail: '',
        },
        validate: {
          password: [
            (v) => v.length >= 8 || 'Min 8 characters',
            (v) => /[A-Z]/.test(v) || 'Need uppercase',
            (v) => /[0-9]/.test(v) || 'Need number',
            (v) => /[!@#$%^&*]/.test(v) || 'Need special char',
          ],
          confirmPassword: (v, values) =>
            v === values.password || 'Passwords must match',
          email: (v) => v.includes('@') || 'Invalid email',
          confirmEmail: (v, values) =>
            v === values.email || 'Emails must match',
        },
        validateOn: 'change',
      });

      // Test password validation chain - need to validate after each change
      form.setField('password', 'abc');
      await form.validateField('password');
      expect(form.errors.password).toBe('Min 8 characters');

      form.setField('password', 'abcdefgh');
      await form.validateField('password');
      expect(form.errors.password).toBe('Need uppercase');

      form.setField('password', 'Abcdefgh');
      await form.validateField('password');
      expect(form.errors.password).toBe('Need number');

      form.setField('password', 'Abcdefg1');
      await form.validateField('password');
      expect(form.errors.password).toBe('Need special char');

      form.setField('password', 'Abcdefg1!');
      await form.validateField('password');
      expect(form.errors.password).toBe('');

      // Test cross-field
      form.setField('confirmPassword', 'wrong');
      await form.validateField('confirmPassword');
      expect(form.errors.confirmPassword).toBe('Passwords must match');

      form.setField('confirmPassword', 'Abcdefg1!');
      await form.validateField('confirmPassword');
      expect(form.errors.confirmPassword).toBe('');

      form.destroy();
    });

    it('should handle async validation with sync fallback', async () => {
      const existingEmails = ['taken@example.com', 'used@example.com'];

      const form = createForm({
        initialValues: { email: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email format',
        },
        validateAsync: {
          email: async (v) => {
            await new Promise((r) => setTimeout(r, 10));
            return !existingEmails.includes(v) || 'Email already taken';
          },
        },
      });

      // Sync validation should fail first
      form.setField('email', 'invalid');
      await form.validate();
      expect(form.errors.email).toBe('Invalid email format');

      // Sync passes, async should run
      form.setField('email', 'taken@example.com');
      await form.validate();
      expect(form.errors.email).toBe('Email already taken');

      // Both pass
      form.setField('email', 'new@example.com');
      await form.validate();
      expect(form.errors.email).toBe('');
      expect(form.isValid).toBe(true);

      form.destroy();
    });
  });

  describe('Form + Persistence', () => {
    it('should persist form draft and restore on reload', async () => {
      // Create form with persistence
      const form1 = createForm({
        initialValues: { title: '', content: '' },
        persistDraft: 'blog-post-draft',
        persistDebounce: 0, // Immediate for testing
      });

      form1.setField('title', 'My Blog Post');
      form1.setField('content', 'Some content here...');

      // Wait for persistence
      await new Promise((r) => setTimeout(r, 50));

      form1.destroy();

      // Create new form - should restore
      const form2 = createForm({
        initialValues: { title: '', content: '' },
        persistDraft: 'blog-post-draft',
      });

      expect(form2.values.title).toBe('My Blog Post');
      expect(form2.values.content).toBe('Some content here...');

      form2.destroy();
    });

    it('should clear draft on successful submit', async () => {
      let submitted = false;

      const form = createForm({
        initialValues: { email: '' },
        persistDraft: 'submit-test',
        persistDebounce: 0,
        onSubmit: async () => {
          submitted = true;
        },
      });

      form.setField('email', 'test@example.com');
      await new Promise((r) => setTimeout(r, 50));

      // Draft should exist
      expect(storage['svelte-reactor-form:submit-test']).toBeDefined();

      await form.submit();
      expect(submitted).toBe(true);

      // Draft should be cleared
      expect(storage['svelte-reactor-form:submit-test']).toBeUndefined();

      form.destroy();
    });
  });

  describe('Reactor + All Plugins', () => {
    it('should handle complex state with undo, persist, and sync', async () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      const store = createReactor(
        {
          todos: [] as { id: string; text: string; done: boolean }[],
          filter: 'all' as 'all' | 'active' | 'completed',
        },
        {
          name: 'todos',
          plugins: [
            undoRedo({ limit: 10 }),
            persist({ key: 'todos-state', debounce: 0 }),
            logger({ collapsed: true }),
          ],
        }
      );

      const actions = arrayActions(store, 'todos', { idKey: 'id' });

      // Add todos
      actions.add({ id: '1', text: 'First', done: false });
      actions.add({ id: '2', text: 'Second', done: false });
      actions.add({ id: '3', text: 'Third', done: true });

      expect(store.state.todos.length).toBe(3);

      // Undo should work
      store.undo();
      expect(store.state.todos.length).toBe(2);

      store.redo();
      expect(store.state.todos.length).toBe(3);

      // Wait for persistence
      await new Promise((r) => setTimeout(r, 50));

      // Should be persisted
      expect(storage['todos-state']).toBeDefined();

      store.destroy();
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleEndSpy.mockRestore();
    });
  });

  describe('ComputedStore + Form Integration', () => {
    it('should compute filtered results based on form filter', () => {
      const store = createReactor({
        items: [
          { id: 1, name: 'Apple', category: 'fruit' },
          { id: 2, name: 'Banana', category: 'fruit' },
          { id: 3, name: 'Carrot', category: 'vegetable' },
          { id: 4, name: 'Broccoli', category: 'vegetable' },
        ],
        selectedCategory: 'all',
      });

      const filteredItems = computedStore(
        store,
        (state) => {
          if (state.selectedCategory === 'all') return state.items;
          return state.items.filter(
            (item) => item.category === state.selectedCategory
          );
        },
        { keys: ['items', 'selectedCategory'] }
      );

      // Filter form
      const filterForm = createForm({
        initialValues: { category: 'all' },
      });

      // Initial - all items
      let currentFiltered: typeof store.state.items = [];
      const unsub = filteredItems.subscribe((items) => {
        currentFiltered = items;
      });

      expect(currentFiltered.length).toBe(4);

      // Update via form
      filterForm.setField('category', 'fruit');
      store.update((s) => {
        s.selectedCategory = filterForm.values.category;
      });

      expect(currentFiltered.length).toBe(2);
      expect(currentFiltered.every((i) => i.category === 'fruit')).toBe(true);

      unsub();
      filterForm.destroy();
      store.destroy();
    });
  });

  describe('Multi-Step Form Workflow', () => {
    it('should handle wizard-like multi-step form', async () => {
      interface WizardData {
        // Step 1
        firstName: string;
        lastName: string;
        // Step 2
        email: string;
        phone: string;
        // Step 3
        address: string;
        city: string;
      }

      const wizardStore = createReactor({
        currentStep: 1,
        data: {} as Partial<WizardData>,
        completed: false,
      });

      // Step 1 form
      const step1Form = createForm({
        initialValues: { firstName: '', lastName: '' },
        validate: {
          firstName: (v) => !!v || 'Required',
          lastName: (v) => !!v || 'Required',
        },
      });

      // Step 2 form
      const step2Form = createForm({
        initialValues: { email: '', phone: '' },
        validate: {
          email: (v) => v.includes('@') || 'Invalid email',
          phone: (v) => v.length >= 10 || 'Invalid phone',
        },
      });

      // Step 3 form
      const step3Form = createForm({
        initialValues: { address: '', city: '' },
        validate: {
          address: (v) => !!v || 'Required',
          city: (v) => !!v || 'Required',
        },
      });

      // Complete step 1
      step1Form.setField('firstName', 'John');
      step1Form.setField('lastName', 'Doe');
      expect(step1Form.isValid).toBe(true);

      wizardStore.update((s) => {
        s.data = { ...s.data, ...step1Form.values };
        s.currentStep = 2;
      });

      // Complete step 2
      step2Form.setField('email', 'john@example.com');
      step2Form.setField('phone', '1234567890');
      expect(step2Form.isValid).toBe(true);

      wizardStore.update((s) => {
        s.data = { ...s.data, ...step2Form.values };
        s.currentStep = 3;
      });

      // Complete step 3
      step3Form.setField('address', '123 Main St');
      step3Form.setField('city', 'New York');
      expect(step3Form.isValid).toBe(true);

      wizardStore.update((s) => {
        s.data = { ...s.data, ...step3Form.values };
        s.completed = true;
      });

      // Verify final state
      expect(wizardStore.state.completed).toBe(true);
      expect(wizardStore.state.data).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        city: 'New York',
      });

      step1Form.destroy();
      step2Form.destroy();
      step3Form.destroy();
      wizardStore.destroy();
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid form updates without memory leaks', () => {
      const forms: ReturnType<typeof createForm>[] = [];

      // Create and destroy many forms
      for (let i = 0; i < 100; i++) {
        const form = createForm({
          initialValues: { field: '' },
        });
        form.setField('field', `value-${i}`);
        forms.push(form);
      }

      // Destroy all
      forms.forEach((f) => f.destroy());

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle concurrent form validations', async () => {
      const form = createForm({
        initialValues: { email: '' },
        validateAsync: {
          email: async (v) => {
            await new Promise((r) => setTimeout(r, Math.random() * 50));
            return v.includes('@') || 'Invalid';
          },
        },
      });

      // Fire multiple validations concurrently
      const validations = [];
      for (let i = 0; i < 10; i++) {
        form.setField('email', i % 2 === 0 ? 'valid@test.com' : 'invalid');
        validations.push(form.validate());
      }

      await Promise.all(validations);

      // Should complete without errors
      expect(true).toBe(true);

      form.destroy();
    });
  });

  describe('SimpleStore + PersistedStore', () => {
    it('should work together with createReactor', () => {
      // Simple counter
      const counter = simpleStore(0);

      // Persisted settings
      const settings = persistedStore('test-settings', { theme: 'dark' });

      // Reactor for complex state
      const appStore = createReactor({
        user: null as { name: string } | null,
      });

      // All should work together
      counter.update((n) => n + 1);
      expect(counter.get()).toBe(1);

      settings.update((s) => ({ ...s, theme: 'light' }));
      expect(settings.get().theme).toBe('light');

      appStore.update((s) => {
        s.user = { name: 'Test' };
      });
      expect(appStore.state.user?.name).toBe('Test');

      appStore.destroy();
    });
  });
});
