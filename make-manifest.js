// Régénère slides/manifest.json (la liste des fichiers chargés au démarrage).
// À lancer après avoir ajouté, retiré ou renommé des fichiers dans slides/ :
//   bun make-manifest.js
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dir, 'slides');
const files = readdirSync(dir)
  .filter((f) => /\.(png|jpe?g|webp|pdf|md|txt)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`slides/manifest.json : ${files.length} fichiers`);
