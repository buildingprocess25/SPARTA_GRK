import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), 'utf8');

test('project Docker image builds and runs the Next.js standalone server', () => {
  const dockerfile = read('../Dockerfile');
  const nextConfig = read('../../../next.config.mjs');
  assert.match(nextConfig, /process\.env\.NEXT_OUTPUT_MODE === ['"]standalone['"]/);
  assert.match(dockerfile, /ENV NEXT_OUTPUT_MODE=standalone/);
  assert.match(dockerfile, /COPY --from=builder[^\n]+\.next\/standalone/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
});

test('Docker enables foreground alarm notifications without configuring Web Push', () => {
  const dockerfile = read('../Dockerfile');
  assert.match(dockerfile, /ARG NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true/);
  assert.doesNotMatch(dockerfile, /WEB_PUSH|VAPID/);
});

test('Docker build context excludes secrets, host modules, git data, and build output', () => {
  const dockerignore = read('../../../.dockerignore');
  for (const entry of ['node_modules', '.git', '.next', '.env*']) {
    assert.match(dockerignore, new RegExp(`^${entry.replace('.', '\\.')}`, 'm'));
  }
  assert.match(dockerignore, /^!\.env\.example$/m);
});
