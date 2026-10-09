#!/usr/bin/env node
/**
 * Generates a salted scrypt hash for one login password, to paste into
 * AUTH_ADMIN_PASSWORD_HASH / AUTH_VALENS_PASSWORD_HASH in .env / Dokploy.
 * Run it locally and keep the plaintext password out of chat logs, shell
 * history files you share, etc.
 *
 * Usage: node scripts/hash-password.mjs <password>
 */
import { hashPassword } from '../src/lib/auth.js';

const password = process.argv[2];
if (!password) {
  console.error('Penggunaan: node scripts/hash-password.mjs <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password sebaiknya minimal 8 karakter.');
  process.exit(1);
}

console.log(hashPassword(password));
