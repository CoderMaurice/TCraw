#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${TCRAW_REMOTE_HOST:-zt}"
REMOTE_IMAGES_DIR="${TCRAW_REMOTE_IMAGES_DIR:-/opt/librechat/images}"
LOCAL_IMAGES_DIR="${TCRAW_LOCAL_IMAGES_DIR:-client/public/images}"
MONGO_CONTAINER="${TCRAW_MONGO_CONTAINER:-chat-mongodb}"
MONGO_DATABASE="${TCRAW_MONGO_DATABASE:-LibreChat}"

if [ ! -d "$LOCAL_IMAGES_DIR" ]; then
  echo "Local images directory not found: $LOCAL_IMAGES_DIR" >&2
  exit 1
fi

ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_IMAGES_DIR'"
rsync -az "$LOCAL_IMAGES_DIR"/ "$REMOTE_HOST:$REMOTE_IMAGES_DIR"/

ssh "$REMOTE_HOST" \
  "REMOTE_IMAGES_DIR='$REMOTE_IMAGES_DIR' MONGO_CONTAINER='$MONGO_CONTAINER' MONGO_DATABASE='$MONGO_DATABASE' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

missing=0
while IFS=$'\t' read -r agent_name avatar_path; do
  if [ -z "${avatar_path:-}" ]; then
    continue
  fi

  avatar_file="$REMOTE_IMAGES_DIR/${avatar_path#/images/}"
  if [ ! -f "$avatar_file" ]; then
    echo "Missing avatar asset: $agent_name -> $avatar_file" >&2
    missing=$((missing + 1))
  fi
done < <(
  docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DATABASE" --quiet --eval '
    db.agents
      .find({ "avatar.filepath": /^\/images\// }, { id: 1, name: 1, avatar: 1 })
      .forEach((agent) => {
        const filepath = String(agent.avatar.filepath || "").split("?")[0];
        print(`${agent.name || agent.id}\t${filepath}`);
      });
  '
)

if [ "$missing" -gt 0 ]; then
  echo "$missing agent avatar asset(s) are missing on $REMOTE_IMAGES_DIR" >&2
  exit 1
fi

echo "Agent avatar assets synced and verified."
REMOTE_SCRIPT
