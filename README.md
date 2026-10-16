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

## Pre-Senior Design development baseline

An earlier FastAPI/PostgreSQL prototype created by Omari Rich before Senior
Design is preserved under
[`archive/pre-senior-design-fastapi`](archive/pre-senior-design-fastapi).
This transferred snapshot establishes the project's documented starting point
inside the current team repository. It is part of the development record, but
it is not part of the active Remix application, deployment, or CI workflow.

See [`docs/pre-senior-design-baseline.md`](docs/pre-senior-design-baseline.md)
for provenance, the exact source commits, and a feature-by-feature comparison.
The dated
[`repository integration audit`](docs/repository-integration-audit-2026-10-15.md)
records the branch, PR, issue, and recommended work-order findings.

The current
[`Design Portfolio II readiness checklist`](docs/design-portfolio-ii-readiness.md)
maps the October 25, 2026 course requirements to repository evidence and
remaining work.
