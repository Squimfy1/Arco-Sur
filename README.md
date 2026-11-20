# Arco-Sur

Moving USDC on the Arc testnet with a guard that decides before anything is
signed, and a log that is checked against the chain afterwards.

Written in TypeScript. The last Python version is kept at the git tag
`python-v1`.

## Layout

```
src/lib/server/   the backend; never sent to the browser
  arc.ts          talks to the Arc chain (RPC client)
  account.ts      loads the throwaway testnet key
  paths.ts        where the key and the evidence log live
  guard.ts        the rules: who may be paid, how much, which tokens
  mandate.ts      this wallet's mandate, shared by the CLI and the page
  intent.ts       decodes what a transaction actually does
  simulate.ts     rehearses a transaction on the node before signing
  events.ts       proves from the receipt what a token call actually did
  send.ts         the send loop; this is the file you run
  reconcile.ts    checks the evidence log against the chain
  contracts.ts    the Arc contracts a user needs: address + ABI
  read.ts         reads any of them with eth_call (no gas, no signing)
  view.ts         turns chain + log readings into the page's strings
src/routes/       the web page (SvelteKit)
  +page.server.ts reads the chain and the log, on the server
  +page.svelte    shows the result; does no arithmetic
tests/      offline tests: guard, intents, refusals, reconciliation, reads, view
docs/       PLAN.md (the staged build plan) and notes/
evidence/   sends.jsonl, one line per send, never rewritten
scratch/    early experiments, not used by the code
```

## Run

Needs Node 24 or newer. Node runs the `.ts` files directly; the command-line
tools have no build step.

```
npm install         # first time only

npm test            # all offline tests, no network
npm run typecheck   # checks the types; writes nothing
npm run send        # sends 0.1 USDC to your own wallet

npm run send -- --to 0x… --amount 0.25              # choose recipient and amount
npm run send -- --token EURC --amount 0.5           # a token transfer
npm run send -- --token EURC --approve 0x… --amount 0.5   # a token approval
```

The guard still decides, on what the transaction actually does: a token
transfer's `value` is 0, so its recipient and amount are decoded from the
calldata. Anything outside the mandate in `send.ts` is refused and logged,
never signed. Unlimited approvals are always refused. A transaction the chain
would revert is rehearsed first and stopped with the chain's own reason, so a
failure never costs gas.

```
npm run reconcile   # every log line vs the chain; exit code 1 if they disagree
```

It reports each line as MATCHED, DIVERGENT (naming both values), PENDING,
MISSING, REVERTED or REFUSED, with the fee it cost; token calls must also be
proven by the token's own event. It lists any nonce the chain has used that
the log never recorded, and follows the money: the balance before the first
logged transaction, minus every fee and every USDC sent to others, must equal
the balance now. Anything left over is reported as unexplained.

```
npm run balances                     # native USDC + every registered token
npm run balances -- --address 0x…    # for any address
```

Decimals are read from each token, never assumed. An address with no
contract is refused, never shown as a zero balance.

```
npm run app        # the wallet page, at http://127.0.0.1:5173
```

A read-only page: holdings, the mandate and how much of it is used, every
logged send and refusal checked against the chain, and the accounting
statement. It reads everything on the server at each load; "Read again"
reloads. It listens on 127.0.0.1 only and is never meant to be deployed: its
server side holds the key.

`account.ts` reads a throwaway testnet private key from `.testnet_key` in the
repo root. That file is gitignored. Never put a key holding real funds there.

## Progress

See [docs/PLAN.md](docs/PLAN.md) for what each stage built and how it was
tested.
