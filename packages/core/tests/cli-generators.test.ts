/**
 * CLI Generators tests - testing init-ai command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { generateClaude } from '../cli/generators/claude.js';
import { generateCursor } from '../cli/generators/cursor.js';
import { generateCopilot } from '../cli/generators/copilot.js';

// Test directories
const TEST_DIR = join(process.cwd(), 'test-output');
const CLAUDE_DIR = join(TEST_DIR, '.claude');
const GITHUB_DIR = join(TEST_DIR, '.github');

describe('CLI Generators', () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Change to test directory
    process.chdir(TEST_DIR);

    // Mock console methods to suppress output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();

    // Clean up test directory
    process.chdir(join(TEST_DIR, '..'));
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Claude Generator', () => {
    it('should create .claude/README.md when file does not exist', async () => {
      await generateClaude({});

      const readmePath = join(CLAUDE_DIR, 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain('svelte-reactor');
    });

    it('should throw error when README.md exists without flags', async () => {
      // Create existing README.md
      mkdirSync(CLAUDE_DIR, { recursive: true });
      writeFileSync(join(CLAUDE_DIR, 'README.md'), '# Existing content');

      // Mock process.exit to prevent test from exiting
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // Should throw error
      await expect(generateClaude({})).rejects.toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should merge with existing README.md when --merge flag is used', async () => {
      // Create existing README.md
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const existingContent = '# My Project Instructions\n\nExisting rules here.';
      writeFileSync(join(CLAUDE_DIR, 'README.md'), existingContent);

      await generateClaude({ merge: true });

      const readmePath = join(CLAUDE_DIR, 'README.md');
      const content = readFileSync(readmePath, 'utf-8');

      // Should contain both existing and new content
      expect(content).toContain('My Project Instructions');
      expect(content).toContain('Existing rules here');
      expect(content).toContain('svelte-reactor');
      expect(content).toContain('---'); // Separator
    });

    it('should overwrite README.md when --force flag is used', async () => {
      // Create existing README.md
      mkdirSync(CLAUDE_DIR, { recursive: true });
      writeFileSync(join(CLAUDE_DIR, 'README.md'), '# Old content');

      await generateClaude({ force: true });

      const readmePath = join(CLAUDE_DIR, 'README.md');
      const content = readFileSync(readmePath, 'utf-8');

      // Should NOT contain old content
      expect(content).not.toContain('Old content');
      // Should contain new content
      expect(content).toContain('svelte-reactor');
    });

    it('should preserve existing content with --merge and add separator', async () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const existingContent = '# Custom Instructions\n\nDo this and that.';
      writeFileSync(join(CLAUDE_DIR, 'README.md'), existingContent);

      await generateClaude({ merge: true });

      const content = readFileSync(join(CLAUDE_DIR, 'README.md'), 'utf-8');

      // Check structure
      expect(content.indexOf('Custom Instructions')).toBeLessThan(content.indexOf('---'));
      expect(content.indexOf('---')).toBeLessThan(content.indexOf('svelte-reactor'));
    });
  });

  describe('Cursor Generator', () => {
    it('should create .cursorrules when file does not exist', async () => {
      await generateCursor({});

      expect(existsSync('.cursorrules')).toBe(true);
      const content = readFileSync('.cursorrules', 'utf-8');
      expect(content).toContain('svelte-reactor');
    });

    it('should throw error when .cursorrules exists without flags', async () => {
      writeFileSync('.cursorrules', '# Existing rules');

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(generateCursor({})).rejects.toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should merge with existing .cursorrules when --merge flag is used', async () => {
      const existingContent = '# Cursor Rules\n\nExisting rules.';
      writeFileSync('.cursorrules', existingContent);

      await generateCursor({ merge: true });

      const content = readFileSync('.cursorrules', 'utf-8');
      expect(content).toContain('Cursor Rules');
      expect(content).toContain('Existing rules');
      expect(content).toContain('svelte-reactor');
    });

    it('should overwrite .cursorrules when --force flag is used', async () => {
      writeFileSync('.cursorrules', '# Old rules');

      await generateCursor({ force: true });

      const content = readFileSync('.cursorrules', 'utf-8');
      expect(content).not.toContain('Old rules');
      expect(content).toContain('svelte-reactor');
    });
  });

  describe('Copilot Generator', () => {
    it('should create .github/copilot-instructions.md when file does not exist', async () => {
      await generateCopilot({});

      const instructionsPath = join(GITHUB_DIR, 'copilot-instructions.md');
      expect(existsSync(instructionsPath)).toBe(true);

      const content = readFileSync(instructionsPath, 'utf-8');
      expect(content).toContain('svelte-reactor');
    });

    it('should throw error when copilot-instructions.md exists without flags', async () => {
      mkdirSync(GITHUB_DIR, { recursive: true });
      writeFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), '# Existing');

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(generateCopilot({})).rejects.toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should merge with existing instructions when --merge flag is used', async () => {
      mkdirSync(GITHUB_DIR, { recursive: true });
      const existingContent = '# Copilot Instructions\n\nExisting instructions.';
      writeFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), existingContent);

      await generateCopilot({ merge: true });

      const content = readFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), 'utf-8');
      expect(content).toContain('Copilot Instructions');
      expect(content).toContain('Existing instructions');
      expect(content).toContain('svelte-reactor');
    });

    it('should overwrite instructions when --force flag is used', async () => {
      mkdirSync(GITHUB_DIR, { recursive: true });
      writeFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), '# Old');

      await generateCopilot({ force: true });

      const content = readFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), 'utf-8');
      expect(content).not.toContain('# Old');
      expect(content).toContain('svelte-reactor');
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple generators without conflicts', async () => {
      await generateClaude({});
      await generateCursor({});
      await generateCopilot({});

      expect(existsSync(join(CLAUDE_DIR, 'README.md'))).toBe(true);
      expect(existsSync('.cursorrules')).toBe(true);
      expect(existsSync(join(GITHUB_DIR, 'copilot-instructions.md'))).toBe(true);
    });

    it('should handle merge for all generators simultaneously', async () => {
      // Setup existing files
      mkdirSync(CLAUDE_DIR, { recursive: true });
      mkdirSync(GITHUB_DIR, { recursive: true });
      writeFileSync(join(CLAUDE_DIR, 'README.md'), '# Claude');
      writeFileSync('.cursorrules', '# Cursor');
      writeFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), '# Copilot');

      // Merge all
      await generateClaude({ merge: true });
      await generateCursor({ merge: true });
      await generateCopilot({ merge: true });

      // Check all files contain both original and new content
      const claudeContent = readFileSync(join(CLAUDE_DIR, 'README.md'), 'utf-8');
      expect(claudeContent).toContain('# Claude');
      expect(claudeContent).toContain('svelte-reactor');

      const cursorContent = readFileSync('.cursorrules', 'utf-8');
      expect(cursorContent).toContain('# Cursor');
      expect(cursorContent).toContain('svelte-reactor');

      const copilotContent = readFileSync(join(GITHUB_DIR, 'copilot-instructions.md'), 'utf-8');
      expect(copilotContent).toContain('# Copilot');
      expect(copilotContent).toContain('svelte-reactor');
    });
  });
});
