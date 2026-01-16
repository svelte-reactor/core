// Vitest setup file
import { beforeEach, afterEach } from 'vitest';

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Cleanup after each test
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
  error: console.error,
};
