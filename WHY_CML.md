# CML: Historical Context and Research Direction

> Research record maintained by **xSQUIB LLC**

This page gives a reader context for CML Local Alpha: the engineering question
that led to it, the evidence the Alpha currently provides, and the research
direction it is intended to explore.

It is not a product claim, a performance claim, or a statement that CML has
solved a general problem. The project record should make its current limits as
easy to inspect as its successful demonstrations.

## Starting question

A system can often describe its present state. The harder question comes after a
proposed change fails:

1. What was the last accepted state?
2. What precisely changed?
3. Why was the proposed state rejected?
4. Can another person inspect the same result later?

CML explores one narrow response: express continuity constraints in a document,
validate the proposed state, retain the last accepted state when validation
fails, and preserve evidence of both outcomes.

## Historical progression

### Continuity as an inspectable question

The work began from a practical concern: a change can be locally plausible yet
still be wrong for the state in which it is applied. A later failed edit should
not silently erase the conditions that made an earlier state acceptable.

This is not a claim to have invented continuity, validation, state machines, or
provenance. It is a research question about how those established ideas can be
made explicit, inspectable, and recoverable in a portable workflow.

### Reference-compiler foundation

CML uses a reference compiler to parse and statically validate a continuity
document. The compiler provides specific acceptance and rejection diagnostics.
Static validation is useful evidence, but it does not establish runtime truth,
renderer behavior, timing behavior, or safety.

### Local accepted-state workflow

CML Local Alpha puts that foundation into a local workflow:

- edit or import a CML document;
- validate the exact saved draft;
- retain the last accepted state when a new draft fails;
- keep a small history of checks; and
- export an unsigned SHA-256 receipt containing source, diagnostics, normalized
  state, and compiler provenance.

The workflow is deliberately local: no cloud account, telemetry, or external
service is required for the Alpha.

### Public Alpha — 10 October 2026

CML Local Alpha 0.1.0-alpha.1 was released as a Windows + WSL evaluation
package. It includes a fixed archive, checksum, supplied fixtures, a
10-minute test script, and a feedback channel.

The release is an invitation to reproduce a narrow workflow. It is not a
production certification.

### Independent evaluation — current stage

The first outside evaluation is intentionally small: five candid tester reports
focused on four questions.

- Is installation understandable?
- Does retaining accepted state after a failed edit make sense?
- Are the diagnostics clear enough to act on?
- Is the resulting receipt useful to another engineer?

Positive, negative, and inconclusive reports all belong in the project record.

## Long-term research direction

The long-term direction is a portable continuity and evidence layer for
software and research workflows in which an invalid change should not replace a
known-good state.

Its working principle is:

> **Known state. Verified change. Truthful recovery.**

Future work may investigate host adapters, canonical accepted-state stores,
derived projections, policy-bound changes, and reproducible evidence packages.
Those are research directions, not capabilities established by this Alpha.

### Supporting frontier work

Work at the edge of engineering and science benefits when assumptions, state
changes, constraints, and recovery evidence can be examined by others. CML's
possible role is supportive: helping make that record explicit and portable.

CML does not claim to identify discoveries, prove scientific results, certify
runtime behavior, or authorize a deployment. Any stronger claim must be earned
by a fixed implementation, retained evidence, independent replication, and
clear scope limits.

## What this Alpha establishes

| Demonstrated in Alpha | Not established by Alpha |
| --- | --- |
| Local persistence of CML drafts | Runtime correctness |
| Static compiler acceptance or rejection | Renderer or media behavior |
| Preservation of the last accepted state after a failed edit | Timing or performance guarantees |
| SHA-256 receipt generation and local receipt checking | Cryptographic signing or third-party attestation |
| A reproducible tester workflow | Production readiness, physical safety, or launch authority |

## Research record and attribution

CML is a research and software project maintained by xSQUIB LLC. It is
developed with AI-assisted engineering and is intended to remain inspectable,
challengeable, and extensible by others.

The public record should preserve the source version, tests, failures,
replications, corrections, and contributor attribution needed to evaluate each
claim. Evidence that contradicts a hypothesis is part of the research record,
not something to remove.

## Read next

- [CML Local Alpha README](README.md)
- [Tester instructions](TESTER_README.md)
- [10-minute test script](tester/TEST_SCRIPT_10_MIN.md)
- [Feedback template](tester/FEEDBACK_TEMPLATE.md)
- [Release and fixed archive](https://github.com/cstolting-collab/CML-Local-Alpha/releases/tag/v0.1.0-alpha.1)
