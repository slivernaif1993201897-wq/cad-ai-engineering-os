#!/usr/bin/env bash
set -euo pipefail
RUNTIME_ROOT="/home/ubuntu/external-runtimes/text-to-cad-b97ff01"
SOURCE_ROOT="/home/ubuntu/external-audits/text-to-cad-current"
SOURCE_REPOSITORY="https://github.com/earthtojake/text-to-cad.git"
SOURCE_COMMIT="b97ff01f3f34ff0c87c84d1e9a6bd42d3cec21ed"
rm -rf "$SOURCE_ROOT" "$RUNTIME_ROOT"
mkdir -p "$(dirname "$SOURCE_ROOT")" "$RUNTIME_ROOT/site-packages"
git clone --filter=blob:none "$SOURCE_REPOSITORY" "$SOURCE_ROOT"
git -C "$SOURCE_ROOT" checkout --detach "$SOURCE_COMMIT"
test "$(git -C "$SOURCE_ROOT" rev-parse HEAD)" = "$SOURCE_COMMIT"
sudo pip3 install --target "$RUNTIME_ROOT/site-packages" 'cadgen==0.4.26' 'build123d==0.11.1'
cat > "$RUNTIME_ROOT/runtime-manifest.json" <<JSON
{"sourceRepository":"$SOURCE_REPOSITORY","sourceCommit":"$SOURCE_COMMIT","cadgen":"0.4.26","build123d":"0.11.1","python":"python3"}
JSON
chmod -R a+rX "$RUNTIME_ROOT" "$SOURCE_ROOT"
printf 'TEXT_TO_CAD_RUNTIME_ROOT=%s\nTEXT_TO_CAD_SOURCE_ROOT=%s\nTEXT_TO_CAD_PYTHON=python3\n' "$RUNTIME_ROOT" "$SOURCE_ROOT"
