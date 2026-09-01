# Default Sol-Luna Profile Design

## Goal

Make `sol-luna` the default execution profile while retaining `adaptive` as an explicit opt-in. Release the standalone package as 1.6.0 and the workflow pack as 1.4.0.

## Semantics

- An unqualified `install` writes schema version 1 with `executionProfile: "sol-luna"`.
- `install --profile adaptive` remains supported and persists `adaptive`.
- An existing valid `adaptive` configuration remains authoritative for routing. Running an unqualified install again explicitly selects the new `sol-luna` default.
- A missing profile configuration routes as `sol-luna`.
- A malformed or unsupported configuration still returns `NEEDS_CONTEXT` with the exact problem.
- `doctor` keeps its existing inspection and optional profile-matching behavior.
- Under `sol-luna`, Tier 1 uses Luna Fast, Tier 2 and Tier 3 use Luna Executor, and Tier 3 remains Sol plan -> Luna execute -> Sol verify.
- Terra execution is available only when `adaptive` is explicitly selected.
- Transaction, rollback, uninstall, tier, Scout, and six-agent installation contracts remain unchanged.

## Documentation

The English and Chinese README files in both distributions must state prominently near the top that Sol plans and verifies while Luna executes by default, and that Terra requires explicit `adaptive` selection. Default installation examples come before opt-in examples.

## Distribution

- The standalone canonical Skill is byte-mirrored into the workflow pack.
- The quota composite adopts the same missing-profile default in its main contract, footer, assets, and installer.
- Provenance records the final standalone commit, release version, and canonical digest.

## Acceptance criteria

1. Default install persists `sol-luna`; explicit `adaptive` persists and routes as `adaptive`.
2. Missing configuration routes as `sol-luna`; bad configuration still yields `NEEDS_CONTEXT`.
3. Install failures preserve the rollback contract.
4. Canonical mirror and quota composite checks pass.
5. Package and CLI smoke tests pass.
6. Both README languages make the new default prominent.
7. Local installation is healthy after synchronization.
8. Both remote repositories match their final local commits after push.
