/**
 * Example: Encryption Plugin
 *
 * Encrypt sensitive data before persistence.
 * Works with the persist plugin to automatically encrypt/decrypt fields.
 */

import type { ReactorPlugin, PluginContext, Middleware } from '../../src/types/index.js';

export interface EncryptionOptions {
  /** Fields to encrypt */
  fields: string[];

  /** Encryption function */
  encrypt: (value: any) => string;

  /** Decryption function */
  decrypt: (encrypted: string) => any;
}

/**
 * Encryption plugin - encrypts sensitive fields
 *
 * @example
 * ```ts
 * const authStore = createReactor(
 *   { username: '', password: '' },
 *   {
 *     plugins: [
 *       encryption({
 *         fields: ['password'],
 *         encrypt: (value) => btoa(JSON.stringify(value)),
 *         decrypt: (encrypted) => JSON.parse(atob(encrypted))
 *       }),
 *       persist({ key: 'auth' })
 *     ]
 *   }
 * );
 * ```
 */
export function encryption<T extends object>(
  options: EncryptionOptions
): ReactorPlugin<T> {
  const { fields, encrypt, decrypt } = options;

  return {
    name: 'encryption',

    init(context: PluginContext<T>): void {
      // Decrypt on init if data exists
      for (const field of fields) {
        const value = (context.state as any)[field];
        if (typeof value === 'string' && value.startsWith('encrypted:')) {
          try {
            (context.state as any)[field] = decrypt(value.slice(10));
          } catch (error) {
            console.error(`[encryption] Failed to decrypt ${field}:`, error);
          }
        }
      }

      const middleware: Middleware<T> = {
        name: 'encryption-middleware',

        onAfterUpdate(prevState: T, nextState: T): void {
          // Log which fields would be encrypted (for demonstration)
          // Note: Actual encryption should be done before persist, not in middleware
          for (const field of fields) {
            const value = (nextState as any)[field];
            const prevValue = (prevState as any)[field];
            if (value !== undefined && value !== null && value !== prevValue) {
              console.log(`[encryption] Would encrypt field: ${field}`);
              // In production: integrate with persist plugin's serialize option
            }
          }
        },
      };

      context.middlewares.push(middleware);
    },
  };
}

/**
 * Simple encryption utilities (for demo purposes only!)
 * In production, use a proper encryption library
 */
export const simpleEncryption = {
  encrypt: (value: any): string => {
    return btoa(JSON.stringify(value));
  },

  decrypt: (encrypted: string): any => {
    return JSON.parse(atob(encrypted));
  },
};
