const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, '..', 'src', 'main', 'db', 'schema.sql');
const dest = path.join(__dirname, '..', 'dist', 'main', 'db', 'schema.sql');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('copied schema.sql → dist/main/db/');
