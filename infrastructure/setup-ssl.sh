#!/bin/bash
# HTTPS/SSL setup for VitaHub production server (Ubuntu/Debian)
# Run as root or with sudo on the server.
# Prerequisite: domain DNS pointing to server IP 167.235.195.236

set -e

DOMAIN="${1:-hubvit.app}"  # Replace with actual domain when available
EMAIL="${2:-admin@vitahub.cl}"

echo "=== Setting up HTTPS for $DOMAIN ==="

# Install certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

# Verify auto-renewal
certbot renew --dry-run

echo "=== SSL setup complete ==="
echo "Certificates installed for $DOMAIN"
echo "Auto-renewal is configured via systemd timer"
