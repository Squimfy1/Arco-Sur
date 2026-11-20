# Arco-Sur

Moving USDC on the Arc testnet with a guard that decides before anything is
signed, and a log that is checked against the chain afterwards.

Written in TypeScript. The last Python version is kept at the git tag
`python-v1`.

## Layout

```
src/        the code
  arc.ts      talks to the Arc chain (RPC client)
  guard.ts    the mandate: who may be paid, and how much
  send.ts     the send loop; this is the file you run
  reconcile.ts  checks the evidence log against the chain
tests/      offline tests: the guard, refusals, and reconciliation
docs/       PLAN.md (the staged build plan) and notes/
evidence/   sends.jsonl, one line per send, never rewritten
scratch/    early experiments, not used by the code
```

## Run

Needs Node 24 or newer. Node runs the `.ts` files directly; there is no build
step.

```
npm install         # first time only

npm test            # 30 tests, no network
npm run typecheck   # checks the types; writes nothing
npm run send        # sends 0.1 USDC to your own wallet

npm run send -- --to 0x… --amount 0.25   # choose recipient and amount
```

The guard still decides. A recipient or amount outside the mandate in
`send.ts` is refused and logged, never signed.

```
npm run reconcile   # every log line vs the chain; exit code 1 if they disagree
```

It reports each line as MATCHED, DIVERGENT (naming both values), PENDING,
MISSING, REVERTED or REFUSED, and lists any nonce the chain has used that the
log never recorded.

`send.ts` reads a throwaway testnet private key from `.testnet_key` in the
repo root. That file is gitignored. Never put a key holding real funds there.

## Progress

See [docs/PLAN.md](docs/PLAN.md). Stages 1–3 are done: send and verify,
refusals recorded and never sent, and reconciliation of the log against the
chain.
