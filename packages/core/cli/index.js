#!/usr/bin/env node

import sade from 'sade';
import prompts from 'prompts';
import kleur from 'kleur';
import { generateClaude } from './generators/claude.js';
import { generateCursor } from './generators/cursor.js';
import { generateCopilot } from './generators/copilot.js';

const prog = sade('svelte-reactor');

prog.version('0.2.3');

prog
  .command('init-ai')
  .describe('Generate AI assistant instructions for svelte-reactor')
  .option('--force', 'Overwrite existing configuration files')
  .option('--merge', 'Merge with existing configuration files')
  .action(async (opts) => {
    console.log('\n' + kleur.bold().cyan('🚀 Svelte Reactor - AI Setup') + '\n');

    const response = await prompts([
      {
        type: 'select',
        name: 'provider',
        message: 'Select your AI assistant:',
        choices: [
          { title: 'Claude Code (Anthropic)', value: 'claude' },
          { title: 'Cursor AI', value: 'cursor' },
          { title: 'GitHub Copilot', value: 'copilot' }
        ],
        initial: 0
      }
    ]);

    if (!response.provider) {
      console.log('\n' + kleur.yellow('Cancelled') + '\n');
      process.exit(0);
    }

    const generators = {
      claude: generateClaude,
      cursor: generateCursor,
      copilot: generateCopilot
    };

    await generators[response.provider](opts);
  });

prog.parse(process.argv);
