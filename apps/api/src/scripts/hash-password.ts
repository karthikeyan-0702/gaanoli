import { hashPassword } from '../lib/password.js';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx tsx src/scripts/hash-password.ts "your-password"');
  process.exit(1);
}

console.log(hashPassword(password));
