# Why CML Exists

> **xSQUIB LLC** · Continuity research and evidence tooling

CML Local Alpha is an early public artifact in a broader continuity-engineering
research line. Its purpose is modest and concrete: when a proposed change fails
static validation, the last accepted state should remain available for inspection,
recovery, and comparison.

The Alpha does not claim to execute a runtime, render media, measure timing,
authorize launches, or certify physical safety. It demonstrates a local workflow
for checking a CML document, retaining accepted state across failed edits, and
exporting a reproducible record of the result.

## The question behind the work

Many systems can describe their current state. Fewer make it easy to answer four
questions after a change fails:

1. What was last accepted?
2. What changed?
3. Why was the proposed change rejected?
4. Can another person inspect the same evidence?

CML explores an explicit, portable answer: describe continuity constraints in a
document; validate the proposed state; retain the last accepted state; and keep a
record that can be checked later.

## Project lineage

### 1. The continuity question

The work began with a practical engineering concern: a locally valid operation
can still produce an unwanted change when it is applied in the wrong state or
when a later edit loses the conditions that made the earlier state acceptable.

CML treats accepted state as something to preserve and inspect, rather than
something a failed edit may silently overwrite.

### 2. A reference-compiler foundation

CML uses a reference compiler to parse and statically validate a continuity
document. The compiler makes rules and rejection diagnostics inspectable. It is
a foundation for evidence, not a claim that static validation establishes
runtime truth.

### 3. A local accepted-state workflow

CML Local Alpha adds a local, human-facing workflow around that foundation:

- edit or import a CML document;
- validate the exact saved draft;
- preserve the last accepted state when a new draft fails;
- keep a small check history; and
- export an unsigned SHA-256 receipt containing source, diagnostics, normalized
  state, and compiler provenance.

The result is designed to be inspectable without a cloud account, telemetry, or
external service.

### 4. First public Alpha — 10 October 2026

CML Local Alpha 0.1.0-alpha.1 was released as a Windows + WSL prerelease with a
fixed archive, checksum, supplied fixtures, a 10-minute test script, and a
structured feedback channel. This is an evaluation release, not a production
certification.

### 5. Independent evaluation — current stage

The immediate goal is five candid external tester reports. The questions are
deliberately narrow:

- Is installation understandable?
- Does the accepted-state behavior make sense after a failed edit?
- Are the diagnostics clear enough to act on?
- Is the verification receipt useful to another engineer?

Feedback, failures, and scope limits are evidence. They are not defects to hide.

## Long-term aim

xSQUIB LLC is working toward a portable continuity and evidence layer for
software and research workflows where a bad change should not erase a known-good
state.

The intended direction is:

> **Known state. Verified change. Truthful recovery.**

Over time, useful CML components may include host adapters, canonical
accepted-state stores, derived projections, policy-bound changes, and
reproducible evidence packages. Each component must earn its claims through
versioned source, tests, retained failures, and independent reproduction.

CML's potential contribution to frontier work is supportive, not declarative:
make assumptions, changes, constraints, and recovery evidence more legible to
the people doing the work. It does not claim to identify, validate, or authorize
scientific discoveries.

## How recognition is earned

Recognition is not a branding claim. xSQUIB LLC intends to earn it by making
work that another person can:

1. clone or download;
2. run against a fixed version;
3. observe failing and passing behavior;
4. inspect the resulting evidence; and
5. cite or challenge the result.

That standard protects both the project and the people who evaluate it.

## What Alpha establishes — and what it does not

| Current Alpha establishes | Not established by Alpha |
| --- | --- |
| Local persistence of CML drafts | Runtime correctness |
| Static compiler acceptance or rejection | Renderer or media behavior |
| Preservation of the last accepted state across a failed edit | Timing or performance guarantees |
| SHA-256 receipt generation and local receipt checking | Cryptographic signing or third-party attestation |
| A reproducible tester workflow | Production readiness, physical safety, or launch authority |

## Attribution and collaboration

CML is an xSQUIB LLC research and software project. It is developed with
AI-assisted engineering and is intended to be inspectable, challengeable, and
extendable by others.

The project does not claim to have invented continuity, state machines,
validation, provenance, or the broader engineering fields it draws upon.
Contributors, prior research, successful replications, and contradictory
evidence should remain visible in the public record.

## Read next

- [CML Local Alpha README](README.md)
- [Tester instructions](TESTER_README.md)
- [10-minute test script](tester/TEST_SCRIPT_10_MIN.md)
- [Feedback template](tester/FEEDBACK_TEMPLATE.md)
- [Release and fixed archive](https://github.com/cstolting-collab/CML-Local-Alpha/releases/tag/v0.1.0-alpha.1)
