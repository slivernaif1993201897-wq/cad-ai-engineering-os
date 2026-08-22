#!/usr/bin/env bash
set -euo pipefail

ROOT="artifacts/generic-job"
INPUT="$ROOT/input"
PROBE="$ROOT/probe"
RESULT="$ROOT/result"
IMAGE="cad-ai-generic-user-job:${GITHUB_SHA:-local}"
ENVIRONMENT_ID="GITHUB-DOCKER-INTERNAL-TEST-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
MAX_INPUT_BYTES=5242880
JOB_SOURCE="${CAD_AI_JOB_SOURCE:-FIXTURE_BASELINE}"

rm -rf "$ROOT"
mkdir -p "$INPUT" "$PROBE" "$RESULT"
case "$JOB_SOURCE" in
  FIXTURE_BASELINE)
    pnpm exec tsx scripts/ci/generate-cad-generic-cantilever.ts
    pnpm exec tsx scripts/ci/generate-generic-user-job-manifest.ts
    mv "$INPUT/generic-cantilever.step" "$INPUT/cad-artifact.step"
    ;;
  CAD_AGENT)
    pnpm exec tsx scripts/ci/generate-cad-agent-runtime-job.ts
    ;;
  *)
    echo "Unsupported static job source: $JOB_SOURCE" >&2
    exit 64
    ;;
esac

input_bytes=$(du -sb "$INPUT" | awk '{print $1}')
test "$input_bytes" -le "$MAX_INPUT_BYTES"
docker build --pull --tag "$IMAGE" docker/generic-user-job
image_id=$(docker image inspect "$IMAGE" --format '{{.Id}}')

run_container() {
  local name="$1"
  local mode="$2"
  local destination="$3"
  local container
  local runtime_output="$destination/runtime-output"
  mkdir -p "$runtime_output"
  chmod 0777 "$runtime_output"
  container=$(docker create --name "$name" \
    --read-only --network none --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges \
    --cpus=1 --memory=512m --pids-limit=256 --ulimit fsize=67108864:67108864 \
    --tmpfs /tmp:rw,nosuid,nodev,noexec,mode=1777,size=16m \
    --tmpfs /work:rw,nosuid,nodev,noexec,mode=1777,size=32m \
    --mount "type=bind,src=$(pwd)/$INPUT,dst=/input,readonly" \
    --mount "type=bind,src=$(pwd)/$runtime_output,dst=/output" \
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
    docker rm "$container" >/dev/null
    return "$status"
  fi
  docker rm "$container" >/dev/null
  return "$status"
}

run_container "cad-ai-generic-probe-${GITHUB_RUN_ID:-local}" probe "$PROBE"
python3 scripts/ci/validate_docker_generic_job.py preflight "$PROBE/runtime-output/sandbox-probes.json"
cat > "$INPUT/runtime-preflight.json" <<EOF
{"environmentId":"$ENVIRONMENT_ID","imageId":"$image_id","inputBytes":$input_bytes,"probeHash":"$(sha256sum "$PROBE/runtime-output/sandbox-probes.json" | awk '{print $1}')","dockerInspectHash":"$(sha256sum "$PROBE/docker-inspect.json" | awk '{print $1}')"}
EOF

run_container "cad-ai-generic-run-${GITHUB_RUN_ID:-local}" run "$RESULT"
python3 scripts/ci/validate_docker_generic_job.py result "$INPUT/generic-user-job-manifest.json" "$RESULT/runtime-output"
for mode in stale-job stale-cad mesh-mismatch solver-mismatch configuration-mismatch input-tamper output-tamper; do
  python3 scripts/ci/validate_docker_generic_job.py "$mode" "$INPUT/generic-user-job-manifest.json" "$RESULT/runtime-output"
done

find "$ROOT" -type f -print0 | sort -z | xargs -0 sha256sum > "$ROOT/all-artifacts.sha256"
