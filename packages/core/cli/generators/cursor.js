import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import kleur from 'kleur';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateCursor(options = {}) {
  try {
    const templatePath = join(__dirname, '../../templates/cursor.md');
    const template = readFileSync(templatePath, 'utf-8');

    const outputPath = '.cursorrules';

    // Check if .cursorrules already exists
    const fileExists = existsSync(outputPath);

    if (fileExists && !options.force) {
      if (options.merge) {
        // Merge with existing .cursorrules
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
      // Create new .cursorrules or overwrite with --force
      writeFileSync(outputPath, template);
      const action = options.force && fileExists ? 'Overwritten' : 'Created';
      console.log('\n' + kleur.green('✓') + ` ${action}: ` + kleur.cyan(outputPath));
    }

    console.log('\n' + kleur.bold().yellow('⚠️  IMPORTANT: ') + kleur.bold('Cursor AI will automatically reload the rules.'));
    console.log('\n' + kleur.bold('Next steps:'));
    console.log('  1. Cursor AI will use these rules automatically');
    console.log('  2. Try: ' + kleur.yellow('"Create a todo list with svelte-reactor"'));
    console.log('  3. Cursor will suggest svelte-reactor best practices! 🎉\n');
  } catch (error) {
    console.error(kleur.red('✗ Error creating Cursor rules:'), error.message);
    process.exit(1);
  }
}
