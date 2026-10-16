# Design Portfolio II readiness — October 15, 2026

## Deadline and official sources

Design Portfolio II is due **October 25, 2026** and is worth **75 points**. The
requirements below come from the current course materials:

- [Design Portfolio II template](https://docs.google.com/document/d/1mUBX7hakgAdiBDJv9HPzD9436Ezvr2nPeZkdk9psGa8/edit)
- [Design Portfolio II evaluation](https://docs.google.com/document/d/10qp_z0OMqyIvfSuUjU-3hKK0v3G5s9DhNuVhoASBjGk/edit)
- [CS 472/672 project instructions](https://businge.cs.unlv.edu/teaching/CS472/project/)

This checklist records repository evidence available on October 15. It does not
replace instructor feedback on Design Portfolio I or team-owned documents that
are not stored in this repository.

## Submission requirements

Use the official headings in this order:

1. **Introduction** — abstract and executive summary, revised where DP I
   feedback or project changes require it.
2. **Motivation** — carry forward the supporting research, address DP I
   feedback, and connect three relevant journal articles to the project.
3. **Requirements** — identify the MVP feature set, explicit out-of-scope
   items, technology stack, measurable functional requirements, and measurable
   non-functional requirements. Update anything changed since DP I.
4. **User Study** — conduct a relevant user, client, or stakeholder feedback
   activity with at least three participants. Include the method, participant
   relevance, three to five major findings containing positive and critical
   feedback, and the resulting decisions. Put focused questions in an appendix
   or linked document; full transcripts are not required.
5. **Design Update** — retain or update the architecture diagram so it matches
   the implemented system. Select two representative implemented features. For
   each, include its requirement ID, issue and PR with status, one appropriate
   design diagram, component responsibilities/design rationale, and test,
   coverage, or CI evidence.
6. **Prototype and MVP Progress** — list every DP I MVP feature with one of the
   exact statuses `Complete`, `In Progress`, `Not Started`, or `Blocked`, plus
   issue/PR links, working evidence, and remaining work. Include a small number
   of captioned UI, API, CLI, deployment, or integrated-service artifacts.
   Source-code screenshots alone are not working-system evidence.
7. **Project-Wide Quality Evidence** — link the current deployment or demo when
   available, a recent successful CI run, current coverage results, and the
   repository or client-defined development workflow.
8. **Team Reporting** — link meeting minutes; state the number of meetings since
   DP I and summarize major decisions or unresolved coordination issues. Add an
   updated task chart, individual contribution table, and the required team
   contribution chart.
9. **Challenges and Factors** — for each DP I challenge, give its current
   status, evidence and response, and remaining action.
10. **Conclusion** — revise it to reflect current progress, lessons learned,
    and next steps.

For every implemented feature, preserve the required evidence chain:

> Requirement → Design → Issue/PR → Code → Tests/CI

## Individual requirements

By DP II, **each student** must have:

- at least three meaningful pull requests;
- at least three meaningful peer reviews; and
- direct links to those PRs and reviews in the contribution table.

Meaningful work includes functionality, design improvement, refactoring,
substantive tests, CI configuration, or necessary technical documentation.
Cosmetic changes and artificially split changes do not count. Course guidance
also requires PRs to be reviewed by at least two teammates and each new feature
or use case to have a linked design diagram before its PR.

The current GitHub search finds **zero PRs authored by `riche10`** in the new
repository and review submissions by `riche10` on PRs
[#1](https://github.com/UNLV-CS472-672/2026-F-GROUP3-Makerspace/pull/1),
[#12](https://github.com/UNLV-CS472-672/2026-F-GROUP3-Makerspace/pull/12), and
[#17](https://github.com/UNLV-CS472-672/2026-F-GROUP3-Makerspace/pull/17).
Those three reviews are evidence candidates, but their final acceptance as
meaningful reviews belongs to the instructor.

The baseline-transfer PR may qualify as necessary technical documentation once
it is opened, reviewed, and accepted. Do not count the pre-Senior Design code
itself as a current-course implementation contribution. Plan for three current
implementation PRs so the individual requirement does not depend on the
baseline PR being accepted for credit.

## Current repository readiness

| Requirement                     | Evidence now                                                                                                                                                              | Readiness / gap                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documented starting baseline    | The transferred FastAPI/PostgreSQL snapshot and provenance are on `chore/preserve-pre-senior-design-baseline`.                                                            | Ready for a reviewable PR; not yet merged.                                                                                                                                 |
| Active MVP implementation       | The root Remix/Prisma application implements RebelCard lookup/results, account sessions, roles/restrictions schema, and the ESP8266 foundation.                           | Partially ready; reconcile this list with the DP I MVP table.                                                                                                              |
| Working-system evidence         | Cypress contains check-in and account smoke tests; recent `main` CI passed.                                                                                               | Capture current screenshots/demo output and direct CI links for the portfolio.                                                                                             |
| Architecture and feature design | No current design-diagram folder was found in the repository.                                                                                                             | Add/update the architecture view and diagrams for two implemented features.                                                                                                |
| Requirements traceability       | Existing issues and PRs cover migration, schema, restrictions, and ESP8266 work.                                                                                          | Requirement IDs and a complete requirement-to-test table are missing.                                                                                                      |
| User study                      | No study questions, participant summary, findings, or decisions were found in the repository.                                                                             | Conduct the study with at least three relevant participants.                                                                                                               |
| CI                              | `.github/workflows/ci.yml` runs lint, TypeScript, Vitest coverage, build, and Cypress.                                                                                    | Strong starting point; link a successful run and confirm branch protection.                                                                                                |
| Coverage                        | A local run on October 15 passed 2 unit tests but reported 0.36% statement/line coverage because almost the entire app and generated build output were untested/included. | Urgent. Configure meaningful coverage scope, add substantive tests, and publish the honest result. The rubric gives 5/4/3/2/1/0 points at ≥90/≥80/≥70/≥60/≥50/≤50 percent. |
| Meetings and task chart         | Not found in this repository.                                                                                                                                             | Link the team-owned minutes, meeting count, decisions, and updated task chart.                                                                                             |
| Contribution chart              | Not found in this repository.                                                                                                                                             | Generate it with the required `Workload.ipynb`, real names, and labeled axes. Verify GitHub profiles expose real names.                                                    |
| DP I feedback and revised prose | DP I submission and feedback were not available during this audit.                                                                                                        | Retrieve them before finalizing abstract, executive summary, motivation, requirements, challenges, and conclusion.                                                         |

## Recommended contribution plan for `riche10`

The baseline transfer establishes origin and continuity, but the strongest DP II
evidence will be new, focused engineering work in the active Remix application.
Use a separate issue, branch, design artifact, tests, and PR for each item.

1. **Open the baseline-transfer PR.** Present it as a provenance and integration
   contribution, link old PR #80 as the source record, and request teammate
   review. Do not merge it without review and do not close old PR #80 as part of
   this transfer.
2. **PR 1 — record access decisions.** Create an issue for writing each allowed
   or denied scan outcome to the existing `AccessLog` model. Add a focused
   sequence/activity diagram and tests. This work is unclaimed and provides a
   strong requirement-to-code-to-test trace.
3. **PR 2 — protect and add the administrator landing route.** The home page
   links to `/admin`, but that route does not exist. Define authorization by
   role, add the protected route, test allowed and rejected access, and include
   a focused interaction diagram.
4. **PR 3 — improve test and coverage discipline.** Exclude generated output
   from the coverage denominator, test meaningful server/domain behavior, set a
   truthful initial CI threshold, and document a ratchet plan. Do not lower the
   scope merely to manufacture a high percentage.

Do not take over issues #13 or #15 without coordinating with their current
assignee. After the above work, the next independent feature slices are student
administration, certification award/revoke, and machine/certification
requirements, each ported into Remix rather than copied from the old stack.

## Ten-day priority order

1. **October 15–16:** open and review the baseline-transfer PR; retrieve DP I
   submission/feedback; agree on the current MVP list and requirement IDs.
2. **October 16–20:** deliver the access-log and protected-admin PRs with design
   links and tests; perform substantive reviews on teammate work if any review
   evidence needs strengthening.
3. **October 18–21:** conduct the three-participant feedback activity and record
   three to five findings and resulting decisions.
4. **October 20–22:** deliver the coverage/test PR, run the full pipeline, and
   capture representative working-system evidence.
5. **October 22–24:** assemble the required tables, diagrams, contribution
   chart, meeting summary, challenge update, and direct evidence links; have the
   team review the document against the evaluation sheet.
6. **October 25:** submit only after every status and link has been rechecked.

## Evaluation-sheet cautions

- The evaluation sheet awards its top CI score for enforced tests, coverage
  tracking, and a protected-main workflow; a passing workflow alone is not the
  full criterion.
- The top PR and review scores require focused issue-linked work and actionable,
  architecture-aware review—not approvals without technical feedback.
- The deliverable template says a separate success report is not required,
  while the evaluation sheet still lists a three-point “Success Report: Plan (&
  Estimates)” item. The safest response is a concise contribution/status/next
  estimate in Team Reporting and instructor confirmation if the distinction
  remains unclear.
- The challenge rubric lists choices through four points but an adjacent note
  says strong compliance reaches five. Follow the stronger evidence standard
  and ask the instructor how the point is recorded.
- Graduate students should confirm the additional expectation: 20% of the DP II
  grade is based specifically on architecture and UML quality, with a leading
  role in architectural reasoning.
