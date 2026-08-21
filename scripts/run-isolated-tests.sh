#!/usr/bin/env sh
set -eu

for test_file in tests/*.test.ts; do
  printf 'RUN %s\n' "$test_file"
  pnpm vitest run "$test_file" --reporter=dot
  printf 'PASS %s\n' "$test_file"
done
