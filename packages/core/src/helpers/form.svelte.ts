/**
 * Form Helper - Reactive form management for Svelte 5
 *
 * @module @svelte-reactor/core/helpers/form
 * @since v0.3.0
 */

/**
 * Validation function that returns true for valid, or error message string for invalid
 */
export type ValidationFn<T> = (value: T, values: Record<string, any>) => true | string;

/**
 * Validation rule can be a single function or array of functions
 */
export type ValidationRule<T> = ValidationFn<T> | ValidationFn<T>[];

/**
 * Validation schema for form fields
 */
export type ValidationSchema<T extends Record<string, any>> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

/**
 * Async validation function
 */
export type AsyncValidationFn<T> = (value: T, values: Record<string, any>) => Promise<true | string>;

/**
 * When to trigger validation
 */
export type ValidateOn = 'change' | 'blur' | 'submit';

/**
 * Options for createForm
 */
export interface FormOptions<T extends Record<string, any>> {
  /**
   * Initial form values
   */
  initialValues: T;

  /**
   * Validation rules per field
   *
   * @example
   * ```ts
   * validate: {
   *   email: [
   *     (v) => !!v || 'Email is required',
   *     (v) => v.includes('@') || 'Invalid email'
   *   ],
   *   password: (v) => v.length >= 8 || 'Min 8 characters'
   * }
   * ```
   */
  validate?: ValidationSchema<T>;

  /**
   * Async validation rules (run after sync validation passes)
   *
   * @example
   * ```ts
   * validateAsync: {
   *   email: async (v) => {
   *     const exists = await checkEmailExists(v);
   *     return !exists || 'Email already registered';
   *   }
   * }
   * ```
   */
  validateAsync?: {
    [K in keyof T]?: AsyncValidationFn<T[K]>;
  };

  /**
   * Submit handler
   */
  onSubmit?: (values: T) => void | Promise<void>;

  /**
   * When to validate fields
   * - 'change': Validate on every change (default)
   * - 'blur': Validate when field loses focus
   * - 'submit': Only validate on submit
   * @default 'change'
   */
  validateOn?: ValidateOn;

  /**
   * Storage key for draft persistence
   * If set, form values will be saved to localStorage
   */
  persistDraft?: string;

  /**
   * Debounce draft persistence in milliseconds
   * @default 500
   */
  persistDebounce?: number;

  /**
   * Custom transform before persisting
   */
  persistTransform?: (values: T) => Partial<T>;
}

/**
 * Form state returned by createForm
 */
export interface Form<T extends Record<string, any>> {
  // === Reactive State (use with $form.values, etc.) ===

  /** Current form values */
  readonly values: T;

  /** Initial values (for reset) */
  readonly initialValues: T;

  /** Which fields have been touched (blurred) */
  readonly touched: Record<keyof T, boolean>;

  /** Which fields have been modified from initial */
  readonly dirty: Record<keyof T, boolean>;

  /** Validation errors per field */
  readonly errors: Record<keyof T, string>;

  /** Is the entire form valid (no errors)? */
  readonly isValid: boolean;

  /** Has any field been modified? */
  readonly isDirty: boolean;

  /** Is form currently submitting? */
  readonly isSubmitting: boolean;

  /** Number of submit attempts */
  readonly submitCount: number;

  /** Error from last submit attempt */
  readonly submitError: string | null;

  // === Methods ===

  /**
   * Set a single field value
   *
   * @example
   * ```ts
   * form.setField('email', 'user@example.com');
   * ```
   */
  setField<K extends keyof T>(field: K, value: T[K]): void;

  /**
   * Set multiple field values at once
   *
   * @example
   * ```ts
   * form.setFields({ email: 'user@example.com', name: 'John' });
   * ```
   */
  setFields(values: Partial<T>): void;

  /**
   * Set a field error manually
   *
   * @example
   * ```ts
   * form.setError('email', 'Email already exists');
   * ```
   */
  setError<K extends keyof T>(field: K, error: string): void;

  /**
   * Clear a field error
   *
   * @example
   * ```ts
   * form.clearError('email');
   * ```
   */
  clearError<K extends keyof T>(field: K): void;

  /**
   * Mark a field as touched
   *
   * @example
   * ```ts
   * // In Svelte: onblur={() => form.setTouched('email')}
   * form.setTouched('email');
   * ```
   */
  setTouched<K extends keyof T>(field: K): void;

  /**
   * Validate entire form
   *
   * @returns true if all fields are valid
   *
   * @example
   * ```ts
   * const isValid = await form.validate();
   * if (isValid) {
   *   // proceed
   * }
   * ```
   */
  validate(): Promise<boolean>;

  /**
   * Validate a single field
   *
   * @returns true if field is valid
   *
   * @example
   * ```ts
   * const isValid = await form.validateField('email');
   * ```
   */
  validateField<K extends keyof T>(field: K): Promise<boolean>;

  /**
   * Submit the form
   *
   * Validates all fields, then calls onSubmit if valid.
   *
   * @example
   * ```svelte
   * <form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
   * ```
   */
  submit(): Promise<void>;

  /**
   * Reset form to initial values
   *
   * @example
   * ```ts
   * form.reset();
   * // or reset to new values:
   * form.reset({ email: 'new@example.com' });
   * ```
   */
  reset(values?: Partial<T>): void;

  /**
   * Get field props for binding
   *
   * @example
   * ```svelte
   * <input {...form.field('email')} />
   * ```
   */
  field<K extends keyof T>(name: K): {
    name: K;
    value: T[K];
    oninput: (e: Event) => void;
    onblur: () => void;
  };

  /**
   * Svelte action for automatic field binding
   *
   * @example
   * ```svelte
   * <input use:form.useField={'email'} />
   * <input type="checkbox" use:form.useField={'rememberMe'} />
   * <select use:form.useField={'country'}>...</select>
   * <textarea use:form.useField={'message'} />
   * ```
   */
  useField: <K extends keyof T>(
    node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    name: K
  ) => { destroy: () => void };

  /**
   * Cleanup form (clear persistence, etc.)
   */
  destroy(): void;
}

/**
 * Create a reactive form
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { createForm } from '@svelte-reactor/core/helpers';
 *
 *   const form = createForm({
 *     initialValues: { email: '', password: '' },
 *     validate: {
 *       email: (v) => v.includes('@') || 'Invalid email',
 *       password: (v) => v.length >= 8 || 'Min 8 characters'
 *     },
 *     onSubmit: async (values) => await login(values)
 *   });
 * </script>
 *
 * <form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
 *   <input
 *     type="email"
 *     bind:value={form.values.email}
 *     onblur={() => form.setTouched('email')}
 *   />
 *   {#if form.touched.email && form.errors.email}
 *     <span class="error">{form.errors.email}</span>
 *   {/if}
 *
 *   <button disabled={!form.isValid || form.isSubmitting}>
 *     {form.isSubmitting ? 'Loading...' : 'Submit'}
 *   </button>
 * </form>
 * ```
 */
export function createForm<T extends Record<string, any>>(
  options: FormOptions<T>
): Form<T> {
  const {
    initialValues,
    validate: validateSchema = {} as ValidationSchema<T>,
    validateAsync = {} as { [K in keyof T]?: AsyncValidationFn<T[K]> },
    onSubmit,
    validateOn = 'change',
    persistDraft,
    persistDebounce = 500,
    persistTransform,
  } = options;

  // === Internal State ===
  let _values = $state<T>({ ...initialValues });
  let _initialValues = $state<T>({ ...initialValues });

  // Create touched/dirty/errors as Records
  const keys = Object.keys(initialValues) as (keyof T)[];

  let _touched = $state<Record<keyof T, boolean>>(
    Object.fromEntries(keys.map((k) => [k, false])) as Record<keyof T, boolean>
  );
  let _dirty = $state<Record<keyof T, boolean>>(
    Object.fromEntries(keys.map((k) => [k, false])) as Record<keyof T, boolean>
  );
  let _errors = $state<Record<keyof T, string>>(
    Object.fromEntries(keys.map((k) => [k, ''])) as Record<keyof T, string>
  );

  let _isSubmitting = $state(false);
  let _submitCount = $state(0);
  let _submitError = $state<string | null>(null);

  // Persistence timer
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  // === Derived State ===
  const isValid = $derived(Object.values(_errors).every((e) => !e));
  const isDirty = $derived(Object.values(_dirty).some((d) => d));

  // === Helper Functions ===

  function validateFieldSync<K extends keyof T>(field: K, value: T[K]): string {
    const rules = validateSchema[field];
    if (!rules) return '';

    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (const rule of ruleArray) {
      const result = rule(value, _values);
      if (result !== true) {
        return result;
      }
    }

    return '';
  }

  async function validateFieldAsync<K extends keyof T>(
    field: K,
    value: T[K]
  ): Promise<string> {
    const asyncRule = validateAsync[field];
    if (!asyncRule) return '';

    const result = await asyncRule(value, _values);
    return result === true ? '' : result;
  }

  async function runFieldValidation<K extends keyof T>(field: K): Promise<boolean> {
    const value = _values[field];

    // Run sync validation first
    const syncError = validateFieldSync(field, value);
    if (syncError) {
      _errors[field] = syncError;
      return false;
    }

    // Run async validation if sync passed
    const asyncError = await validateFieldAsync(field, value);
    _errors[field] = asyncError;
    return !asyncError;
  }

  function updateDirty<K extends keyof T>(field: K) {
    _dirty[field] = _values[field] !== _initialValues[field];
  }

  function schedulePersist() {
    if (!persistDraft) return;

    if (persistTimer) {
      clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(() => {
      try {
        const valuesToPersist = persistTransform
          ? persistTransform(_values)
          : _values;
        localStorage.setItem(
          `svelte-reactor-form:${persistDraft}`,
          JSON.stringify(valuesToPersist)
        );
      } catch (error) {
        // Silently fail on localStorage errors
      }
    }, persistDebounce);
  }

  function loadPersistedDraft() {
    if (!persistDraft) return;

    try {
      const stored = localStorage.getItem(`svelte-reactor-form:${persistDraft}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(_values, parsed);

        // Mark loaded fields as dirty
        for (const key of Object.keys(parsed) as (keyof T)[]) {
          if (_values[key] !== _initialValues[key]) {
            _dirty[key] = true;
          }
        }
      }
    } catch (error) {
      // Silently fail on parse errors
    }
  }

  function clearPersistedDraft() {
    if (!persistDraft) return;

    try {
      localStorage.removeItem(`svelte-reactor-form:${persistDraft}`);
    } catch (error) {
      // Silently fail
    }
  }

  // Load persisted draft on init (only in browser)
  if (typeof window !== 'undefined') {
    loadPersistedDraft();
  }

  // === Public API ===

  const form: Form<T> = {
    // Reactive getters
    get values() {
      return _values;
    },
    get initialValues() {
      return _initialValues;
    },
    get touched() {
      return _touched;
    },
    get dirty() {
      return _dirty;
    },
    get errors() {
      return _errors;
    },
    get isValid() {
      return isValid;
    },
    get isDirty() {
      return isDirty;
    },
    get isSubmitting() {
      return _isSubmitting;
    },
    get submitCount() {
      return _submitCount;
    },
    get submitError() {
      return _submitError;
    },

    // Methods
    setField<K extends keyof T>(field: K, value: T[K]) {
      _values[field] = value;
      updateDirty(field);

      if (validateOn === 'change') {
        runFieldValidation(field);
      }

      schedulePersist();
    },

    setFields(values: Partial<T>) {
      for (const [field, value] of Object.entries(values)) {
        const key = field as keyof T;
        _values[key] = value as T[keyof T];
        updateDirty(key);

        if (validateOn === 'change') {
          runFieldValidation(key);
        }
      }

      schedulePersist();
    },

    setError<K extends keyof T>(field: K, error: string) {
      _errors[field] = error;
    },

    clearError<K extends keyof T>(field: K) {
      _errors[field] = '';
    },

    setTouched<K extends keyof T>(field: K) {
      _touched[field] = true;

      if (validateOn === 'blur') {
        runFieldValidation(field);
      }
    },

    async validate(): Promise<boolean> {
      const fields = Object.keys(_values) as (keyof T)[];
      const results = await Promise.all(
        fields.map((field) => runFieldValidation(field))
      );
      return results.every((valid) => valid);
    },

    async validateField<K extends keyof T>(field: K): Promise<boolean> {
      return runFieldValidation(field);
    },

    async submit(): Promise<void> {
      _submitCount++;
      _submitError = null;

      // Mark all fields as touched
      for (const key of keys) {
        _touched[key] = true;
      }

      // Validate all fields
      const isFormValid = await form.validate();

      if (!isFormValid) {
        return;
      }

      if (!onSubmit) {
        return;
      }

      _isSubmitting = true;

      try {
        await onSubmit(_values);
        clearPersistedDraft();
      } catch (error) {
        _submitError =
          error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        _isSubmitting = false;
      }
    },

    reset(values?: Partial<T>) {
      // Reset to new initial values or original
      const newInitial = values
        ? { ..._initialValues, ...values }
        : { ..._initialValues };

      _values = { ...newInitial };
      _initialValues = { ...newInitial };

      // Reset all state
      for (const key of keys) {
        _touched[key] = false;
        _dirty[key] = false;
        _errors[key] = '';
      }

      _submitCount = 0;
      _submitError = null;

      clearPersistedDraft();
    },

    field<K extends keyof T>(name: K) {
      return {
        name,
        get value() {
          return _values[name];
        },
        oninput: (e: Event) => {
          const target = e.target as HTMLInputElement;
          const value =
            target.type === 'checkbox' ? target.checked : target.value;
          form.setField(name, value as T[K]);
        },
        onblur: () => {
          form.setTouched(name);
        },
      };
    },

    useField<K extends keyof T>(
      node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
      name: K
    ) {
      // Set initial value
      const isCheckbox = node instanceof HTMLInputElement && node.type === 'checkbox';
      if (isCheckbox) {
        (node as HTMLInputElement).checked = Boolean(_values[name]);
      } else {
        node.value = String(_values[name] ?? '');
      }

      // Handle input changes
      function handleInput(e: Event) {
        const target = e.target as HTMLInputElement;
        const value = isCheckbox ? target.checked : target.value;
        form.setField(name, value as T[K]);
      }

      // Handle blur for touched state
      function handleBlur() {
        form.setTouched(name);
      }

      // Set up reactive updates using $effect-like pattern
      // We use a simple interval to sync value (Svelte actions don't have $effect)
      let syncInterval: ReturnType<typeof setInterval> | null = null;

      if (typeof window !== 'undefined') {
        syncInterval = setInterval(() => {
          const currentValue = _values[name];
          if (isCheckbox) {
            const checkbox = node as HTMLInputElement;
            if (checkbox.checked !== Boolean(currentValue)) {
              checkbox.checked = Boolean(currentValue);
            }
          } else {
            const stringValue = String(currentValue ?? '');
            if (node.value !== stringValue) {
              node.value = stringValue;
            }
          }
        }, 50);
      }

      // Add event listeners
      node.addEventListener('input', handleInput);
      node.addEventListener('blur', handleBlur);

      return {
        destroy() {
          node.removeEventListener('input', handleInput);
          node.removeEventListener('blur', handleBlur);
          if (syncInterval) {
            clearInterval(syncInterval);
          }
        },
      };
    },

    destroy() {
      if (persistTimer) {
        clearTimeout(persistTimer);
      }
    },
  };

  return form;
}
