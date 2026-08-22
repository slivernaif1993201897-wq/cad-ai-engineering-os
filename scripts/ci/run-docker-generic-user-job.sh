#!/usr/bin/env bash
set -euo pipefail

ROOT="artifacts/generic-job"
INPUT="$ROOT/input"
PROBE="$ROOT/probe"
RESULT="$ROOT/result"
IMAGE="cad-ai-generic-user-job:${GITHUB_SHA:-local}"
ENVIRONMENT_ID="GITHUB-DOCKER-INTERNAL-TEST-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
MAX_INPUT_BYTES=5242880

rm -rf "$ROOT"
mkdir -p "$INPUT" "$PROBE" "$RESULT"
pnpm exec tsx scripts/ci/generate-cad-generic-cantilever.ts
pnpm exec tsx scripts/ci/generate-generic-user-job-manifest.ts

input_bytes=$(du -sb "$INPUT" | awk '{print $1}')
test "$input_bytes" -le "$MAX_INPUT_BYTES"
docker build --pull --tag "$IMAGE" docker/generic-user-job
image_id=$(docker image inspect "$IMAGE" --format '{{.Id}}')

run_container() {
  local name="$1"
  local mode="$2"
  local destination="$3"
  local container
  container=$(docker create --name "$name" \
    --read-only --network none --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges \
    --cpus=1 --memory=512m --pids-limit=256 --ulimit fsize=67108864:67108864 \
    --tmpfs /tmp:rw,nosuid,nodev,noexec,mode=1777,size=16m \
    --tmpfs /work:rw,nosuid,nodev,noexec,mode=1777,size=32m \
    --tmpfs /output:rw,nosuid,nodev,noexec,mode=1777,size=64m \
    --mount "type=bind,src=$(pwd)/$INPUT,dst=/input,readonly" \
    --env "CAD_AI_ENVIRONMENT_ID=$ENVIRONMENT_ID" \
    "$IMAGE" "$mode")
  docker inspect "$container" > "$destination/docker-inspect.json"
  set +e
  docker start -a "$container" > "$destination/container.log" 2>&1
  local status=$?
  set -e
  docker inspect "$container" > "$destination/docker-inspect-after.json"
  if [ "$status" -ne 0 ]; then
    docker logs "$container" > "$destination/docker-engine.log" 2>&1 || true
    docker inspect --format '{{json .State}}' "$container" > "$destination/container-start-state.json"
    docker cp "$container:/output/." "$destination/" > "$destination/docker-cp.log" 2>&1 || true
    docker rm "$container" >/dev/null
    return "$status"
  fi
  docker cp "$container:/output/." "$destination/" > "$destination/docker-cp.log" 2>&1
  docker rm "$container" >/dev/null
  return "$status"
}

run_container "cad-ai-generic-probe-${GITHUB_RUN_ID:-local}" probe "$PROBE"
python3 scripts/ci/validate_docker_generic_job.py preflight "$PROBE/sandbox-probes.json"
cat > "$INPUT/runtime-preflight.json" <<EOF
{"environmentId":"$ENVIRONMENT_ID","imageId":"$image_id","inputBytes":$input_bytes,"probeHash":"$(sha256sum "$PROBE/sandbox-probes.json" | awk '{print $1}')","dockerInspectHash":"$(sha256sum "$PROBE/docker-inspect.json" | awk '{print $1}')"}
EOF

run_container "cad-ai-generic-run-${GITHUB_RUN_ID:-local}" run "$RESULT"
python3 scripts/ci/validate_docker_generic_job.py result "$INPUT/generic-user-job-manifest.json" "$RESULT"
python3 scripts/ci/validate_docker_generic_job.py tamper "$RESULT/result-binding.json"

find "$ROOT" -type f -print0 | sort -z | xargs -0 sha256sum > "$ROOT/all-artifacts.sha256"
