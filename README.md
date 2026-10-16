# 2026-F-GROUP3-Makerspace

Makerspace Access Control

# Deployment

Docker startup applies migrations, runs the compiled Prisma seed, then starts
the app. Rebuild and deploy the image to pick up seed changes; no Docker access
or database tunnel is needed after deployment. Migration or seed failures stop
startup and are reported in the container logs.

## Seeding

The seed creates missing certifications, machines, and the three demo
students. It creates `admin@unlv.nevada.edu` with the initial demo password
`makerspace-admin` only when that account is missing. Change that password before
using the deployment with real data. Later starts preserve existing accounts,
passwords, student records, awards, and machine requirements. Seed writes run in
one transaction, so a failure leaves no partially seeded data.

## Historical pre-Senior Design prototype

An earlier FastAPI/PostgreSQL prototype created by Omari Rich before Senior
Design is preserved under
[`archive/pre-senior-design-fastapi`](archive/pre-senior-design-fastapi).
It is reference material and is not part of the active Remix application,
deployment, or CI workflow.

See [`docs/pre-senior-design-baseline.md`](docs/pre-senior-design-baseline.md)
for provenance, the exact source commits, and a feature-by-feature comparison.
The dated
[`repository integration audit`](docs/repository-integration-audit-2026-10-15.md)
records the branch, PR, issue, and recommended work-order findings.
