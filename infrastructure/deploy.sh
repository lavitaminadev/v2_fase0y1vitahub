#!/bin/bash
# Legacy Docker deploy script.
# Produccion en iHosting usa cPanel Git deployment + Passenger.
# Usage: ./infrastructure/deploy.sh [environment]

set -e

ENV=${1:-production}
COMPOSE_FILE="infrastructure/docker-compose.yml"

echo "Legacy Docker deploy path to $ENV..."

# Pull latest
git pull origin main

# Build and restart
docker-compose -f $COMPOSE_FILE --env-file .env.$ENV build
docker-compose -f $COMPOSE_FILE --env-file .env.$ENV up -d

# Run migrations
docker-compose -f $COMPOSE_FILE exec api npm run migration:run

# Clean old images
docker image prune -f

echo "Legacy Docker deploy complete"
