/**
 * Custom error class for reactor errors with rich context
 */

export interface ReactorErrorContext {
  /** Reactor name that threw the error */
  reactor?: string;

  /** Action being performed when error occurred */
  action?: string;

  /** Plugin that caused the error */
  plugin?: string;

  /** Current state at time of error */
  state?: unknown;

  /** Original error that caused this error */
  cause?: Error;

  /** Helpful tip for resolving the issue */
  tip?: string;
}

/**
 * Error class for reactor-specific errors
 * Provides rich context for debugging
 *
 * @example
 * ```ts
 * throw new ReactorError('Update failed', {
 *   reactor: 'counter',
 *   action: 'increment',
 *   state: { count: 0 },
 *   tip: 'Check if state is initialized correctly.'
 * });
 * ```
 */
export class ReactorError extends Error {
  /** Error context with debugging information */
  readonly context: ReactorErrorContext;

  constructor(message: string, context: ReactorErrorContext = {}) {
    super(message);
    this.name = 'ReactorError';
    this.context = context;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReactorError);
    }
  }

  /**
   * Format error message with full context
   */
  override toString(): string {
    const { reactor, action, plugin, tip, cause } = this.context;

    const parts: string[] = [];

    // Header with reactor name
    const header = reactor ? `[Reactor:${reactor}]` : '[Reactor]';
    parts.push(`${header} ${this.message}`);

    // Context details
    if (action) parts.push(`  Action: ${action}`);
    if (plugin) parts.push(`  Plugin: ${plugin}`);
    if (cause) parts.push(`  Caused by: ${cause.message}`);

    // Helpful tip
    if (tip) {
      parts.push('');
      parts.push(`  Tip: ${tip}`);
    }

    return parts.join('\n');
  }

  /**
   * Create error with tip for common issues
   */
  static withTip(message: string, tip: string, context: Omit<ReactorErrorContext, 'tip'> = {}): ReactorError {
    return new ReactorError(message, { ...context, tip });
  }

  /**
   * Create error for destroyed reactor
   */
  static destroyed(reactorName?: string): ReactorError {
    return new ReactorError('Cannot operate on destroyed reactor', {
      reactor: reactorName,
      tip: 'Create a new reactor instance or check your cleanup logic.',
    });
  }

  /**
   * Create error for invalid state
   */
  static invalidState(message: string, reactorName?: string, state?: unknown): ReactorError {
    return new ReactorError(message, {
      reactor: reactorName,
      state,
      tip: 'Ensure your state is properly initialized and has the expected shape.',
    });
  }

  /**
   * Create error for plugin failures
   */
  static pluginError(pluginName: string, message: string, cause?: Error): ReactorError {
    return new ReactorError(`Plugin "${pluginName}" failed: ${message}`, {
      plugin: pluginName,
      cause,
      tip: `Check the "${pluginName}" plugin configuration and state compatibility.`,
    });
  }
}
