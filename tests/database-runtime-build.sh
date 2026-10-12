#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../.zscripts" && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

FAKE_BIN="$TEST_ROOT/bin"
mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/bun" <<'EOF'
#!/bin/bash
set -euo pipefail

if [ "$#" -ne 2 ] || [ "$1" != "run" ] || [ "$2" != "db:push" ]; then
    echo "unexpected bun invocation: $*" >&2
    exit 1
fi

# The app runs on PostgreSQL: only postgresql:// URLs are valid.
case "${DATABASE_URL:-}" in
    postgresql://*) ;;
    *)
        echo "DATABASE_URL must be a postgresql:// URL, got: ${DATABASE_URL:-<unset>}" >&2
        exit 1
        ;;
esac

printf '%s\n' "$DATABASE_URL" >>"${DB_PUSH_CALLS:?}"
EOF
chmod +x "$FAKE_BIN/bun"

export PATH="$FAKE_BIN:$PATH"
export DB_PUSH_CALLS="$TEST_ROOT/db-push-calls"

PROJECT_DIR="$TEST_ROOT/project"
BUILD_DIR="$TEST_ROOT/build"
mkdir -p "$PROJECT_DIR" "$BUILD_DIR"

# 没有 DATABASE_URL 时必须失败——不能悄悄启动到空数据库。
if PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" env -u DATABASE_URL \
    bash "$SCRIPT_DIR/database-runtime-build.sh"; then
    echo "expected failure when DATABASE_URL is unset" >&2
    exit 1
fi

# file: URL（旧的 SQLite 形式）必须被拒绝。
if PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    DATABASE_URL="file:/tmp/custom.db" \
    bash "$SCRIPT_DIR/database-runtime-build.sh"; then
    echo "expected failure for a file: DATABASE_URL" >&2
    exit 1
fi

# postgresql:// URL 应原样透传给 db:push。
NEON_URL="postgresql://user:pass@ep-example.aws.neon.tech/neondb?sslmode=require"
PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" \
    DATABASE_URL="$NEON_URL" \
    bash "$SCRIPT_DIR/database-runtime-build.sh"

grep -Fx "$NEON_URL" "$DB_PUSH_CALLS"
test "$(wc -l <"$DB_PUSH_CALLS" | tr -d ' ')" = "1"

echo "database runtime build tests passed"
