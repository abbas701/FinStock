#!/usr/bin/env sh
set -e

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Create one with DATABASE_URL and other runtime settings."
  exit 1
fi

echo "Stopping existing containers..."
docker compose down

echo "Rebuilding and starting containers..."
docker compose up -d --build

echo "Redeploy complete. Use 'docker compose logs -f' to follow logs."