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
tests/      offline tests: the guard, and that a refusal never reaches the chain
docs/       PLAN.md (the staged build plan) and notes/
evidence/   sends.jsonl, one line per send, never rewritten
scratch/    early experiments, not used by the code
```

## Run

Needs Node 24 or newer. Node runs the `.ts` files directly; there is no build
step.

```
npm install         # first time only

npm test            # 20 tests, no network
npm run typecheck   # checks the types; writes nothing
npm run send        # sends 0.1 USDC to your own wallet

npm run send -- --to 0x… --amount 0.25   # choose recipient and amount
```

The guard still decides. A recipient or amount outside the mandate in
`send.ts` is refused and logged, never signed.

`send.ts` reads a throwaway testnet private key from `.testnet_key` in the
repo root. That file is gitignored. Never put a key holding real funds there.

## Progress

See [docs/PLAN.md](docs/PLAN.md). Stage 1 (send and verify) and Stage 2
(refusals are recorded, never sent) are done.
