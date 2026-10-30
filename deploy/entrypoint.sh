#!/bin/sh
set -eu

if [ "${ARCHIVE_AUTH:-basic}" = "basic" ]; then
	if [ -z "${ARCHIVE_USER:-}" ] || [ -z "${ARCHIVE_PASSWORD:-}" ]; then
		echo "ARCHIVE_USER and ARCHIVE_PASSWORD must be set (or ARCHIVE_AUTH=off)." >&2
		exit 1
	fi
	ARCHIVE_PASSWORD_HASH="$(caddy hash-password --plaintext "$ARCHIVE_PASSWORD")"
	export ARCHIVE_PASSWORD_HASH
	unset ARCHIVE_PASSWORD
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
