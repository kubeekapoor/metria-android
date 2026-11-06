#!/usr/bin/env node
/* Copia los tokens canónicos a www/ para que la app los cargue por HTTP.
   La fuente de verdad sigue siendo metria-design-system/design-tokens.css:
   no editar www/design-tokens.css a mano. */

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'metria-design-system/design-tokens.css');
const destination = resolve(root, 'www/design-tokens.css');

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log('Tokens sincronizados: metria-design-system/design-tokens.css -> www/design-tokens.css');
