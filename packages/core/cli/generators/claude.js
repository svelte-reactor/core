import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import kleur from 'kleur';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateClaude(options = {}) {
  try {
    const templatePath = join(__dirname, '../../templates/claude.md');
    const template = readFileSync(templatePath, 'utf-8');

    const outputDir = '.claude';
    mkdirSync(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'README.md');

    // Check if README.md already exists
    const fileExists = existsSync(outputPath);

    if (fileExists && !options.force) {
      if (options.merge) {
        // Merge with existing README
        const existingContent = readFileSync(outputPath, 'utf-8');
        const separator = '\n\n---\n\n';
        const newContent = existingContent + separator + '# svelte-reactor Best Practices\n\n' + template;
        writeFileSync(outputPath, newContent);

        console.log('\n' + kleur.green('✓') + ' Updated: ' + kleur.cyan(outputPath) + kleur.dim(' (merged)'));
      } else {
        console.error('\n' + kleur.red('✗ Error: ') + kleur.cyan(outputPath) + ' already exists!');
        console.log('\n' + kleur.bold('Use one of these options:'));
        console.log('  • ' + kleur.yellow('--merge') + '  - Append to existing file');
        console.log('  • ' + kleur.yellow('--force') + '  - Overwrite existing file');
        console.log('\nExample: ' + kleur.cyan('npx svelte-reactor init-ai --merge') + '\n');
        process.exit(1);
      }
    } else {
      // Create new README or overwrite with --force
      writeFileSync(outputPath, template);
      const action = options.force && fileExists ? 'Overwritten' : 'Created';
      console.log('\n' + kleur.green('✓') + ` ${action}: ` + kleur.cyan(outputPath));
    }

    console.log('\n' + kleur.bold().yellow('⚠️  IMPORTANT: ') + kleur.bold('You must restart/reload Claude Code for changes to take effect!'));
    console.log('\n' + kleur.bold('Next steps:'));
    console.log('  1. Close and reopen your project in Claude Code');
    console.log('  2. OR use Command Palette: ' + kleur.cyan('"Developer: Reload Window"'));
    console.log('  3. Try: ' + kleur.yellow('"Create a counter with svelte-reactor"'));
    console.log('  4. Claude will now follow svelte-reactor best practices automatically! 🎉\n');
  } catch (error) {
    console.error(kleur.red('✗ Error creating Claude instructions:'), error.message);
    process.exit(1);
  }
}
