#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_SSH_TARGET=""
if [[ -f "$REPO_ROOT/.env" ]]; then
  # Read only the target setting; do not execute arbitrary .env contents.
  ENV_SSH_TARGET="$(sed -n 's/^BETTERMIAGAO_SSH_TARGET=//p' "$REPO_ROOT/.env" | tail -n 1)"
fi
REMOTE_TARGET="${BETTERMIAGAO_SSH_TARGET:-$ENV_SSH_TARGET}"
REMOTE_REPO="${BETTERMIAGAO_REMOTE_REPO:-}"
REMOTE_WEB_ROOT="/var/www/bettermiagao.org"
BRANCH="${BETTERMIAGAO_BRANCH:-main}"

if [[ -z "$REMOTE_TARGET" ]]; then
  echo "Set BETTERMIAGAO_SSH_TARGET in the local .env file (user@host or an SSH alias)." >&2
  echo "Example: BETTERMIAGAO_SSH_TARGET=deploy@host bash deployment/deploy-bettermiagao.sh" >&2
  exit 2
fi

for command in git ssh; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command not found: $command" >&2
    exit 2
  }
done

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "Refusing deployment: commit and push the Better Miagao changes first." >&2
  exit 1
fi

git -C "$REPO_ROOT" fetch origin "$BRANCH"
LOCAL_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
REMOTE_COMMIT="$(git -C "$REPO_ROOT" rev-parse "origin/$BRANCH")"
if [[ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]]; then
  echo "Refusing deployment: local HEAD must match origin/$BRANCH." >&2
  echo "Local:  $LOCAL_COMMIT" >&2
  echo "Origin: $REMOTE_COMMIT" >&2
  exit 1
fi

echo "Target commit: $REMOTE_COMMIT"
read -r -p "Deploy origin/$BRANCH to Better Miagao? [y/N] " CONFIRM
[[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || {
  echo "Deployment cancelled."
  exit 0
}

ssh "$REMOTE_TARGET" bash -s -- "$REMOTE_REPO" "$BRANCH" "$REMOTE_WEB_ROOT" "$REMOTE_COMMIT" <<'REMOTE_SCRIPT'
set -euo pipefail
repo="$1"
branch="$2"
web_root="$3"
expected_commit="$4"
if [[ -z "$repo" ]]; then repo="$HOME/bettermiagao"; fi

if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git clone --branch "$branch" git@github.com:joebertj/bettermiagao.git "$repo"
fi
if [[ -n "$(git -C "$repo" status --porcelain)" ]]; then
  echo "Refusing deployment: the server checkout has local changes." >&2
  exit 1
fi

git -C "$repo" fetch origin "$branch"
commit="$(git -C "$repo" rev-parse FETCH_HEAD)"
if [[ "$commit" != "$expected_commit" ]]; then
  echo "Refusing deployment: origin/$branch changed after the local check." >&2
  exit 1
fi
git -C "$repo" reset --hard "$commit"
cd "$repo"
npm ci
npm run build
[[ -s dist/index.html ]]
sudo install -d -m 0755 "$web_root"
sudo rsync --archive --delete dist/ "$web_root/"
sudo test -s "$web_root/index.html"
echo "Deployed $commit to $web_root"
REMOTE_SCRIPT

echo "Deployment complete. Static files changed; Nginx does not need a reload."
