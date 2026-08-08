#!/bin/sh
set -eu

deployment_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
environment_file="$deployment_dir/.env"
template_file="$deployment_dir/.env.example"

if [ -e "$environment_file" ]; then
  printf '%s\n' "Refusing to overwrite existing $environment_file" >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  printf '%s\n' "openssl is required to generate deployment secrets" >&2
  exit 1
}

database_password=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 48)
webhook_verify_token=$(openssl rand -hex 32)
deletion_hash_secret=$(openssl rand -hex 48)
temporary_file=$(mktemp "$deployment_dir/.env.tmp.XXXXXX")
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM
chmod 600 "$temporary_file"

sed \
  -e "s/__SOCIALS_DB_PASSWORD__/$database_password/" \
  -e "s/__JWT_SECRET__/$jwt_secret/" \
  -e "s/__META_WEBHOOK_VERIFY_TOKEN__/$webhook_verify_token/" \
  -e "s/__META_DATA_DELETION_HASH_SECRET__/$deletion_hash_secret/" \
  "$template_file" > "$temporary_file"

mv "$temporary_file" "$environment_file"
trap - EXIT HUP INT TERM
printf '%s\n' "Created $environment_file with mode 600"
