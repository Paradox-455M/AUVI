#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
# Override any of these by setting them in your environment or a .env file.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present (KEY=VALUE format, no export needed)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    echo "📄 Loading .env"
    set -a
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.env"
    set +a
fi

DATABASE_URL="${DATABASE_URL:-postgres://localhost:5432/auvi?sslmode=disable}"
JWT_SECRET="${JWT_SECRET:-}"
PORT="${PORT:-8080}"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"

# ─── Validate required config ─────────────────────────────────────────────────
if [[ -z "$JWT_SECRET" ]]; then
    echo ""
    echo "❌  JWT_SECRET is not set."
    echo ""
    echo "    Option 1 — set it in this shell:"
    echo "      export JWT_SECRET=your-secret-here && ./start.sh"
    echo ""
    echo "    Option 2 — create a .env file next to start.sh:"
    echo "      echo 'JWT_SECRET=your-secret-here' > .env"
    echo "      ./start.sh"
    echo ""
    exit 1
fi

# ─── Check dependencies ───────────────────────────────────────────────────────
for cmd in psql go; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "❌  '$cmd' not found. Please install it first."
        exit 1
    fi
done

# ─── Extract DB name from URL for createdb ────────────────────────────────────
# postgres://localhost:5432/auvi?sslmode=disable  →  auvi
DB_NAME="$(echo "$DATABASE_URL" | sed -E 's|.*://[^/]*/([^?]*).*|\1|')"

# ─── Create DB if it doesn't exist ───────────────────────────────────────────
echo "🗄️  Checking database '$DB_NAME'..."
if ! psql "$DATABASE_URL" -c '\q' 2>/dev/null; then
    echo "   Creating database '$DB_NAME'..."
    createdb "$DB_NAME" || {
        echo "❌  Could not create database. Is PostgreSQL running?"
        exit 1
    }
fi

# ─── Run migration ────────────────────────────────────────────────────────────
echo "🔄  Applying migrations from db/migrate.sql..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/db/migrate.sql" -v ON_ERROR_STOP=1
echo "✅  Migrations applied"

# ─── Build ────────────────────────────────────────────────────────────────────
echo "🔨  Building..."
cd "$SCRIPT_DIR"
go build -o ./.bin/auvi ./cmd/api/main.go
echo "✅  Build done"

# ─── Start ────────────────────────────────────────────────────────────────────
echo ""
echo "🎵  Starting Auvi backend on :$PORT"
echo "    Database : $DATABASE_URL"
echo "    Uploads  : $UPLOAD_DIR"
echo ""

exec ./.bin/auvi
