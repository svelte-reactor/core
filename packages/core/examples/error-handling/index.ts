/**
 * Error Handling Examples Runner
 *
 * Run all error handling examples to demonstrate error handling patterns
 * in svelte-reactor.
 *
 * Usage:
 *   npm run examples:error-handling
 *   or
 *   node --loader tsx examples/error-handling/index.ts
 */

import {
  basicValidationExample,
  validationPluginExample,
  crossFieldValidationExample,
  validationWarningsExample
} from './validation-errors';

import {
  basicAsyncErrorExample,
  retryWithBackoffExample,
  detailedErrorExample,
  cancellationExample,
  errorRecoveryExample,
  userFriendlyErrorsExample
} from './async-errors';

import {
  quotaExceededExample,
  fallbackStorageExample,
  privateBrowsingExample,
  corruptionRecoveryExample,
  safeStorageWrapperExample
} from './persistence-errors';

import {
  safeMiddlewareExample,
  pluginInitializationExample,
  errorPropagationExample,
  resilientPluginExample,
  errorRecoveryExample as pluginErrorRecoveryExample
} from './plugin-errors';

// =============================================================================
// Example Runner
// =============================================================================

interface ExampleGroup {
  title: string;
  description: string;
  examples: {
    name: string;
    fn: () => void | Promise<void>;
  }[];
}

const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    title: 'Validation Errors',
    description: 'Input validation and data integrity checks',
    examples: [
      { name: 'Basic Validation', fn: basicValidationExample },
      { name: 'Validation Plugin', fn: validationPluginExample },
      { name: 'Cross-Field Validation', fn: crossFieldValidationExample },
      { name: 'Validation Warnings', fn: validationWarningsExample }
    ]
  },
  {
    title: 'Async Errors',
    description: 'API failures, network issues, and async operations',
    examples: [
      { name: 'Basic Async Errors', fn: basicAsyncErrorExample },
      { name: 'Retry with Backoff', fn: retryWithBackoffExample },
      { name: 'Detailed Error Objects', fn: detailedErrorExample },
      { name: 'Cancellation', fn: cancellationExample },
      { name: 'Error Recovery', fn: errorRecoveryExample },
      { name: 'User-Friendly Messages', fn: userFriendlyErrorsExample }
    ]
  },
  {
    title: 'Persistence Errors',
    description: 'Storage failures and data persistence issues',
    examples: [
      { name: 'Quota Exceeded', fn: quotaExceededExample },
      { name: 'Fallback Storage', fn: fallbackStorageExample },
      { name: 'Private Browsing', fn: privateBrowsingExample },
      { name: 'Corruption Recovery', fn: corruptionRecoveryExample },
      { name: 'Safe Storage Wrapper', fn: safeStorageWrapperExample }
    ]
  },
  {
    title: 'Plugin & Middleware Errors',
    description: 'Plugin initialization and middleware error handling',
    examples: [
      { name: 'Safe Middleware', fn: safeMiddlewareExample },
      { name: 'Plugin Initialization', fn: pluginInitializationExample },
      { name: 'Error Propagation', fn: errorPropagationExample },
      { name: 'Resilient Plugin', fn: resilientPluginExample },
      { name: 'Error Recovery Strategy', fn: pluginErrorRecoveryExample }
    ]
  }
];

async function runExample(
  groupTitle: string,
  exampleName: string,
  fn: () => void | Promise<void>
): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    console.error(`\n❌ EXAMPLE FAILED: ${groupTitle} > ${exampleName}`);
    console.error((error as Error).message);
    console.error((error as Error).stack);
    return false;
  }
}

async function runAllExamples(interactive = false) {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║            ERROR HANDLING EXAMPLES - svelte-reactor              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  let totalExamples = 0;
  let passedExamples = 0;

  for (const group of EXAMPLE_GROUPS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📚 ${group.title.toUpperCase()}`);
    console.log(`   ${group.description}`);
    console.log(`${'='.repeat(70)}\n`);

    for (const example of group.examples) {
      totalExamples++;

      if (interactive) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`▶️  Running: ${example.name}`);
        console.log(`${'─'.repeat(70)}`);
      }

      const success = await runExample(group.title, example.name, example.fn);

      if (success) {
        passedExamples++;
        if (interactive) {
          console.log(`\n✅ ${example.name} - PASSED\n`);
        }
      } else {
        if (interactive) {
          console.log(`\n❌ ${example.name} - FAILED\n`);
        }
      }

      // Add spacing between examples
      if (interactive) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total Examples: ${totalExamples}`);
  console.log(`Passed: ${passedExamples} ✅`);
  console.log(`Failed: ${totalExamples - passedExamples} ❌`);
  console.log(`Success Rate: ${((passedExamples / totalExamples) * 100).toFixed(1)}%`);
  console.log('═'.repeat(70) + '\n');

  return passedExamples === totalExamples;
}

async function runSpecificGroup(groupIndex: number) {
  if (groupIndex < 0 || groupIndex >= EXAMPLE_GROUPS.length) {
    console.error(`Invalid group index. Must be between 0 and ${EXAMPLE_GROUPS.length - 1}`);
    process.exit(1);
  }

  const group = EXAMPLE_GROUPS[groupIndex];

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📚 ${group.title.toUpperCase()}`);
  console.log(`   ${group.description}`);
  console.log(`${'='.repeat(70)}\n`);

  let passed = 0;

  for (const example of group.examples) {
    console.log(`\n▶️  ${example.name}`);
    const success = await runExample(group.title, example.name, example.fn);
    if (success) {
      passed++;
      console.log(`✅ PASSED`);
    } else {
      console.log(`❌ FAILED`);
    }
  }

  console.log(`\n📊 Results: ${passed}/${group.examples.length} passed\n`);
}

async function showMenu() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        ERROR HANDLING EXAMPLES - Interactive Menu               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log('Available example groups:\n');

  EXAMPLE_GROUPS.forEach((group, index) => {
    console.log(`  ${index + 1}. ${group.title} (${group.examples.length} examples)`);
    console.log(`     ${group.description}\n`);
  });

  console.log(`  0. Run all examples\n`);
  console.log('Usage: npm run examples:error-handling [group-number]');
  console.log('Example: npm run examples:error-handling 1  (run Validation Errors)\n');
}

// =============================================================================
// CLI Interface
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showMenu();
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    showMenu();
    return;
  }

  const groupArg = args[0];

  if (!groupArg) {
    // Run all examples
    const success = await runAllExamples(true);
    process.exit(success ? 0 : 1);
  } else {
    const groupIndex = parseInt(groupArg, 10) - 1;
    if (isNaN(groupIndex)) {
      console.error('Invalid group number. Use --list to see available groups.');
      process.exit(1);
    }

    if (groupIndex === -1) {
      // Run all
      const success = await runAllExamples(true);
      process.exit(success ? 0 : 1);
    } else {
      // Run specific group
      await runSpecificGroup(groupIndex);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic usage
export {
  runAllExamples,
  runSpecificGroup,
  EXAMPLE_GROUPS
};
