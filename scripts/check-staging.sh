
#!/usr/bin/env bash
set -euo pipefail

# Verify that the Makerspace staging backend is responding.
# Usage: bash scripts/check-staging.sh http://SERVER:PORT

if [[ $# -ne 1 ]]; then
    echo "Usage: bash scripts/check-staging.sh <base-url>"
    exit 2
fi

BASE_URL="${1%/}"
HEALTH_URL="${BASE_URL}/healthcheck"

# Make sure the URL is valid for an HTTP check.
if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
    echo "ERROR: URL must start with http:// or https://"
    exit 2
fi

# Check that curl is installed.
if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is required."
    exit 2
fi

echo "Checking Makerspace backend: $HEALTH_URL"

# Send a request and capture the HTTP status code.
if STATUS=$(curl --silent --show-error \
    --output /dev/null \
    --write-out "%{http_code}" \
    --connect-timeout 5 \
    --max-time 10 \
    "$HEALTH_URL"); then

    if [[ "$STATUS" == "200" ]]; then
        echo "PASS: Backend is healthy (HTTP 200)"
        exit 0
    fi

    echo "FAIL: Backend returned HTTP $STATUS"
else
    echo "FAIL: Could not connect to the backend."
fi

exit 1
