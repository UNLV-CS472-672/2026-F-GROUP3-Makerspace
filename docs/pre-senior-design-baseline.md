# Pre-Senior Design baseline

## Purpose

The files under
[`archive/pre-senior-design-fastapi`](../archive/pre-senior-design-fastapi)
transfer the project's earlier FastAPI/PostgreSQL prototype into the current
team repository. This makes the initial baseline and its authorship part of the
new repository's reviewable development record instead of leaving that context
only in a repository the team no longer uses.

The Remix/Prisma implementation at the repository root remains the active
application. The baseline is intentionally isolated so the transfer does not
replace or silently modify work already contributed by current teammates.

## Source and attribution

The archived prototype was created by Omari Rich (`riche10`) before Senior
Design and later committed to `berhea1/Group-3` on the
`feature/pre-senior-design-baseline` branch. The source branch is represented by
open pull request
[`berhea1/Group-3#80`](https://github.com/berhea1/Group-3/pull/80).

The old repository and PR are source evidence only; new development should
continue in `UNLV-CS472-672/2026-F-GROUP3-Makerspace`. The transfer preserves
the fact that this code predates Senior Design and does not present the
pre-course implementation as work completed during the course.

The imported snapshot is `c8467f5d83fef81cb1162f5107c342ca97fe5a7d`.
Its prototype-specific history is:

- `e30e870547d5fca6df8257f16e6ec8df10eff275` — add the Shop deployment and
  preview-environment baseline
- `ae7162ca67149921b33007ec5ac3ac782ea51557` — document the pre-Senior Design
  project origin
- `40be407fefe3e1744ab599055ca42bd009fbb154` — clean baseline whitespace
- `c8467f5d83fef81cb1162f5107c342ca97fe5a7d` — adjust the baseline README

The source commit identifiers and original author metadata remain available in
the source repository. The copied files retain their contents while living
under an archive prefix in this repository.

## Import boundary

Only prototype-specific files were imported:

- FastAPI application, Jinja templates, and administrator setup command
- PostgreSQL bootstrap schema
- Dockerfiles and the prototype Docker Compose definition
- placeholder environment configuration
- prototype README, contributing guide, and project-origin note

Course-lab material from the source repository (`ci_lab`, `tdd_lab`,
`test_coverage_lab`, and `repo_mining`) was deliberately excluded. The source
repository's root CI configuration was also excluded because it belongs to that
repository and would conflict with this project's existing workflows.

## Capability comparison

| Capability                                        | Archived FastAPI prototype       | Active Remix application                            | Integration decision                             |
| ------------------------------------------------- | -------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| RebelCard lookup and access result                | Implemented                      | Implemented                                         | Keep the Remix implementation                    |
| Administrator authentication                      | Implemented                      | Login and session support exist                     | Extend the Remix implementation                  |
| Student create, edit, activation, and deletion    | Implemented                      | Data model exists; no administrator routes          | Candidate for a focused issue and PR             |
| Certification management and student awards       | Implemented                      | Data model exists; no administrator routes          | Port behavior with Remix-specific tests          |
| Machine management and certification requirements | Implemented                      | Data model exists; no administrator routes          | Port behavior in a separate reviewed PR          |
| Access audit records                              | Schema support exists            | Prisma model exists; scan route does not write logs | Add requirements and tests before implementation |
| Preview deployment layout                         | Documented for the earlier stack | Not part of the current deployment                  | Do not copy without an infrastructure review     |

## Rules for future use

- Do not run the archived application as production code without a separate
  security and dependency review.
- Do not copy the archived database schema over Prisma migrations.
- Port one capability at a time through a current issue and focused feature
  branch, with tests against the active Remix application.
- Preserve the original attribution when archived logic materially informs a
  new implementation.
- Treat the baseline as the documented starting point, not as a substitute for
  current-course issues, implementation, testing, peer review, or MVP evidence.
- Keep current-team contributions on `main`; do not merge the old repository's
  root tree into this one.
