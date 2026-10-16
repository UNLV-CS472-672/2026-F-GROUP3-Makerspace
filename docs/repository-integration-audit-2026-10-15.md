# Repository integration audit — 2026-10-15

## Executive summary

The team repository is already the canonical Remix/Prisma application. Its
current `main` includes the website initialization, repository cleanup, Vite
migration, database restriction model, and ESP8266 satellite foundation. The
latest CI and repository-lint workflows on `main` pass.

The earlier FastAPI/PostgreSQL prototype should not be merged at the repository
root. It uses a different application stack, and its source branch also descends
from a repository containing unrelated course labs. The safe integration is the
isolated historical archive in this branch, followed by focused issues and PRs
that port only still-needed capabilities into the active Remix application.

## Current team repository

- Repository: `UNLV-CS472-672/2026-F-GROUP3-Makerspace`
- Canonical branch: `main`
- Audited `main` commit: `779391a5284509d80529076226260ce468669e54`
- Access: `riche10` has maintain and push permissions
- Open pull requests at audit time: none
- Latest `main` CI: passing
- Latest `main` repository lint: passing

### Remote branches present before this audit

| Branch                    | Tip       | State relative to `main`                    | Treatment                             |
| ------------------------- | --------- | ------------------------------------------- | ------------------------------------- |
| `main`                    | `779391a` | canonical                                   | Keep protected and PR-only            |
| `feature/add-restriction` | `7ac1564` | merged in PR #18; 0 commits ahead, 5 behind | Leave until the team approves cleanup |
| `migrate-remix-vite`      | `00ce951` | merged in PR #12; 0 commits ahead, 6 behind | Leave until the team approves cleanup |

No branch was deleted or rewritten during this audit.

## Pull request history

| PR             | Result             | Contribution                                    |
| -------------- | ------------------ | ----------------------------------------------- |
| #1             | Merged             | Initialize/migrate the Remix website            |
| #3, #4, #5, #7 | Merged             | Dependency action updates                       |
| #6             | Closed, not merged | Superseded stale-action update                  |
| #8             | Merged             | Clean up repository GitHub files                |
| #10            | Merged             | Update issue templates and environment handling |
| #11            | Merged             | Remove the obsolete Prisma `Class` model        |
| #12            | Merged             | Migrate the Remix application to Vite           |
| #17            | Merged             | Add ESP8266 satellite HTTP communication        |
| #18            | Merged             | Add user roles and student restrictions         |

## Issue assessment

| Issue                        | Assessment                   | Evidence / next action                                                                                                            |
| ---------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| #2 — Migrate website         | Completed                    | Closed by the merged website initialization work                                                                                  |
| #9 — Update issue templates  | Completed                    | Closed after PR #10; current templates are project-specific                                                                       |
| #14 — Update database schema | Completed                    | Closed after PR #18; `User.roles` and `StudentRestriction` model the requested behavior                                           |
| #16 — ESP8266 foundation     | Completed                    | Closed after PR #17; firmware and example secrets are on `main`                                                                   |
| #13 — Iconify                | Actionable but already owned | Open and assigned to `davidpenrose`; the package is not present in `package.json`                                                 |
| #15 — restriction popup      | Actionable but already owned | Open and assigned to `davidpenrose`; dependency #14 is complete, but the scan/results routes do not yet query active restrictions |

Issues #13 and #15 should not be taken over without coordinating with their
assignee. No issue was closed, reassigned, relabeled, or commented on during
this audit.

## Baseline source assessment

### `berhea1/Group-3` and `riche10/Group-3` default branches

The two default branches are part of the earlier class repository history and
contain `ci_lab`, `tdd_lab`, `test_coverage_lab`, and `repo_mining` artifacts.
They are not suitable merge sources for the Senior Design application.

### Correct historical source

The relevant prototype is
`berhea1/Group-3:feature/pre-senior-design-baseline` at `c8467f5`. It has four
prototype-specific commits by Omari Rich and is represented by the still-open
historical PR `berhea1/Group-3#80`. That PR remains untouched as an attribution
record.

The active Remix repository does not need the prototype's framework,
deployment, or database schema at its root. Still-useful behavior that is not
yet present in the active application includes:

- administrator-facing student management
- certification CRUD and award/revoke workflows
- machine CRUD and certification-requirement workflows
- recording access decisions in the existing `AccessLog` model

## Safe integration order

1. Review the historical archive branch and agree on whether the prototype
   should live in the new repository. Merge only through a reviewed PR.
2. Keep the active Remix/Prisma tree authoritative. Do not merge the old
   repository root, old Docker Compose file, or SQL bootstrap schema over it.
3. Coordinate with `davidpenrose` before contributing to issues #13 or #15.
4. Create a new issue for access-decision logging. This is the best first new
   contribution for `riche10`: it is meaningful, currently unclaimed, uses the
   existing `AccessLog` model, and can be delivered with focused unit/integration
   tests without colliding with the restriction-popup UI.
5. Add an authorization-protected administrator landing route as the
   prerequisite for management features. The current home page links to
   `/admin`, but no `/admin` route exists.
6. Port administrator capabilities as independent vertical slices: students,
   certifications/awards, then machines/requirements. Each slice should have its
   own issue, branch, tests, and PR.
7. Revisit preview deployment only after an infrastructure review; do not copy
   the old Portainer assumptions into the active stack by default.

## Recommended branch discipline

- Branch from an up-to-date `origin/main` for every issue.
- Use one issue and one coherent feature per branch.
- Rebase or merge `main` before requesting final review, but never force-update
  a teammate's branch.
- Keep PRs in draft while validation or design review is incomplete.
- Require a teammate review before merging, and let the PR close its issue only
  after the implementation and tests are accepted.
- Do not delete merged branches until the team agrees on its cleanup policy.
