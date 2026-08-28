#!/usr/bin/env sh
set -eu

for test_file in tests/*.test.ts; do
  printf 'RUN %s\n' "$test_file"
  pnpm vitest run "$test_file" --reporter=dot --maxWorkers=1 --minWorkers=1 --testTimeout=20000
  printf 'PASS %s\n' "$test_file"
done
