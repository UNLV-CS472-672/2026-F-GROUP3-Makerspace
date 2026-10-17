#!/usr/bin/env bash
set -euo pipefail

# Automated tests for the Makerspace staging health check.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/check-staging.sh"

# Create a temporary fake curl command so tests do not
# require a running website or database.
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

cat > "$TEST_DIR/curl" <<'EOF'
#!/usr/bin/env bash

if [[ "${MOCK_CURL_FAIL:-0}" == "1" ]]; then
    echo "Simulated connection failure" >&2
    exit 7
fi

if [[ -n "${EXPECTED_URL:-}" ]]; then
    if [[ "${@: -1}" != "$EXPECTED_URL" ]]; then
        echo "Unexpected health-check URL" >&2
        exit 9
    fi
fi

printf '%s' "${MOCK_HTTP_STATUS:-200}"
EOF

chmod +x "$TEST_DIR/curl"

PASSED=0
FAILED=0

run_test() {
    local name="$1"
    local expected_exit="$2"
    local expected_text="$3"
    shift 3

    local output
    local actual_exit

    if output=$(PATH="$TEST_DIR:$PATH" "$@" 2>&1); then
        actual_exit=0
    else
        actual_exit=$?
    fi

    if [[ "$actual_exit" -eq "$expected_exit" &&
          "$output" == *"$expected_text"* ]]; then
        echo "PASS: $name"
        PASSED=$((PASSED + 1))
    else
        echo "FAIL: $name"
        echo "  Expected exit code: $expected_exit"
        echo "  Actual exit code: $actual_exit"
        echo "  Output: $output"
        FAILED=$((FAILED + 1))
    fi
}

run_test "Healthy backend" 0 "Backend is healthy" \
    env MOCK_HTTP_STATUS=200 \
    bash "$CHECK_SCRIPT" http://example.test:8110

run_test "Server returns HTTP 503" 1 "HTTP 503" \
    env MOCK_HTTP_STATUS=503 \
    bash "$CHECK_SCRIPT" http://example.test:8110

run_test "Connection failure" 1 "Could not connect" \
    env MOCK_CURL_FAIL=1 \
    bash "$CHECK_SCRIPT" http://example.test:8110

run_test "Invalid URL" 2 "URL must start" \
    bash "$CHECK_SCRIPT" invalid-url

run_test "Missing URL argument" 2 "Usage:" \
    bash "$CHECK_SCRIPT"

run_test "Trailing slash handled correctly" 0 "Backend is healthy" \
    env MOCK_HTTP_STATUS=200 \
    EXPECTED_URL=http://example.test:8110/healthcheck \
    bash "$CHECK_SCRIPT" http://example.test:8110/

echo
echo "Results: $PASSED passed, $FAILED failed"

if [[ "$FAILED" -gt 0 ]]; then
    exit 1
fi

exit 0
