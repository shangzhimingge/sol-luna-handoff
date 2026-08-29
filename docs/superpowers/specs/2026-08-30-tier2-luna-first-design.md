# Tier 2 Luna-first routing design

## Problem

The former Tier 2 boundary treated file count and work labels such as business logic or debugging as model-capability proxies. That sent bounded work with an explicit strategy and observable acceptance evidence to Terra even when Luna could execute it reliably. The new boundary makes Luna the cost-aware default and reserves Terra for a closed set of reasoning and uncertainty exceptions.

Tier classification, conditional Scout and Planner selection, Tier 1 direct execution, Tier 3 Sol–Terra–Sol execution, conditional Tier 2 verification, output budgets, and correction/replan rules are unchanged.

## Definitions

- **Bounded**: permitted subsystems and interfaces and the stopping condition are known before implementation.
- **Explicit strategy**: the brief or binding plan identifies the intended approach without asking the executor to choose a new architecture or shared-interface meaning.
- **Independently verifiable**: runnable checks or observable acceptance evidence can evaluate the result. This does not require zero local implementation judgment.
- **Terra exception**: one of the six closed conditions below, not a proxy such as file count.

## Decision table

| Situation | Executor or transition | Reason |
| --- | --- | --- |
| Explicit bounded implementation across 3–8 files | Luna | Multi-file work alone is not a Terra condition. |
| Known failure diagnosable within one bounded module | Luna | Ordinary local diagnosis is permitted. |
| Cross-subsystem or cross-file invariant must be derived | Terra | Terra exception 1. |
| Shared-interface semantics require judgment | Terra | Terra exception 2. |
| Root-cause candidates remain ambiguous | Terra | Terra exception 3. |
| Integration outcome remains uncertain | Terra | Terra exception 4. |
| Major refactor is required | Terra | Terra exception 5. |
| Unknown failure requires non-local diagnosis | Terra | Terra exception 6. |
| A Luna condition lacks facts and no exception is established | `NEEDS_CONTEXT` | Name the missing bounded, explicit, or verification facts. |
| A planning trigger can establish strategy or verification | Compact plan, then re-evaluate | Planning precedes executor selection. |
| The boundary remains ambiguous before editing | Tier 3 ambiguity upgrade | Existing ambiguity routing applies. |
| Luna first discovers an exception or required scope expansion | `UPGRADE_NEEDED`, then Terra once | Stop before expanding scope or making further edits. |
| Executor discovers a Tier 3 predicate | Existing tier upgrade | This is not a Luna-to-Terra handoff. |

## State transitions

1. After normal Tier and planning decisions, evaluate the six Terra exceptions.
2. If none exists and the work is bounded, explicit, and independently verifiable, start `luna_executor`.
3. If a Luna condition is not established, use an applicable compact plan before executor selection, return `NEEDS_CONTEXT` for exact missing facts, or take the existing Tier 3 ambiguity route when the boundary remains unclear before editing. Re-evaluate after new context or a plan. Terra is not a fallback.
4. Luna may make ordinary implementation and local diagnostic decisions inside the binding scope.
5. On first discovering an exception or required scope expansion, Luna preserves its diff, stops before crossing the boundary, and returns `UPGRADE_NEEDED` with evidence.
6. The coordinator replaces Luna with one `terra_executor`. That same Terra finishes implementation and ordinary correction rounds. There is no Terra-to-Luna return or second same-kind executor switch.
7. The correction count continues across the handoff. Only acceptance of a new plan under the existing two-round replan rule resets it.

## Handoff payload

The coordinator passes:

- the original task brief or binding plan and acceptance criteria;
- the Luna report and named triggering exception;
- changed files and current diff;
- fresh check evidence, remaining failure evidence, and the next decision needed.

Terra preserves useful work and continues from the evidence rather than restarting without cause.

## Examples and counterexamples

- Updating five handlers according to an already specified mapping with unit tests is Luna work, even though it is multi-file business logic.
- Repairing a known parser failure whose reproduction and owning module are known is Luna work.
- Choosing whether two subsystems should reinterpret a shared field is Terra work because it needs shared-interface judgment.
- Chasing an intermittent failure across unknown modules is Terra work because it needs non-local diagnosis.
- A deployment, security, public-API, architectural, or otherwise Tier 3 discovery follows the Tier upgrade route; calling it a normal executor handoff would violate the tier contract.

## Compatibility and migration

Release 1.4.0 keeps exact legacy recognition narrow. The installer recognizes only published Skill-tree and agent hashes, including the v1.3.1 Skill tree and its Luna and Terra definitions. Unknown customized Skill or agent content remains a preflight collision and causes zero partial writes. The English and Chinese documentation, Skill contract, fallback contracts, and executor prompts use the same Luna-first vocabulary.
