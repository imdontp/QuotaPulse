import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Enumerate only plain entries, retaining whether any subtree could not be inspected. */
export function discoverFiles(root: string, matches: (name: string) => boolean, allowMissingRoot: boolean) {
  const files: string[] = [];
  let incomplete = false;
  const visit = (dir: string, depth: number) => {
    if (depth > 4) { incomplete = true; return; }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (!(allowMissingRoot && depth === 0 && (error as NodeJS.ErrnoException).code === 'ENOENT')) incomplete = true;
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) incomplete = true;
      else if (entry.isDirectory()) visit(path, depth + 1);
      else if (entry.isFile() && matches(entry.name)) files.push(path);
    }
  };
  visit(root, 0);
  return { files, incomplete };
}
