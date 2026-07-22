# Legacy Docker deploy script.
# Produccion en iHosting usa cPanel Git deployment + Passenger.
# Este archivo se conserva solo como referencia para escenarios no cPanel.

param(
    [Parameter(Position = 0)]
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"
$COMPOSE_FILE = "infrastructure/docker-compose.yml"
$ENV_FILE = ".env.$Environment"

Write-Host "Legacy Docker deploy path for $Environment..." -ForegroundColor Yellow

# Pull latest
git pull origin main
if (-not $?) { throw "git pull failed" }

# Build and restart
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE build
if (-not $?) { throw "docker-compose build failed" }

docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d
if (-not $?) { throw "docker-compose up failed" }

# Run migrations
docker-compose -f $COMPOSE_FILE exec -T api npm run migration:run
if (-not $?) { throw "migrations failed" }

# Clean old images
docker image prune -f

Write-Host "Legacy Docker deploy complete" -ForegroundColor Green
