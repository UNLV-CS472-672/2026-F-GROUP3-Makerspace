# Staging Health Check

This script checks whether the Makerspace backend is responding
correctly after deployment.

The existing /healthcheck endpoint also verifies database
connectivity.

## Running the Check

Run the script using Bash and provide the website's base URL:

```bash
bash scripts/check-staging.sh http://localhost:3000
```

For the LAN staging server:

```bash
bash scripts/check-staging.sh http://192.168.10.65:8110
```

The staging address is only reachable from an authorized network.

## Results

- HTTP 200: Backend healthy, exit code 0.
- HTTP errors or connection failures: Exit code 1.
- Missing or invalid arguments: Exit code 2.

## Automated Tests

Run the simulated tests:

```bash
bash scripts/test-check-staging.sh
```

These tests cover successful responses, HTTP errors,
connection failures, invalid arguments, and trailing slashes.

GitHub Actions runs the automated tests when the relevant
scripts or workflow change.

The automated tests do not connect to the real staging server.
A separate live health check is required to verify deployment.
