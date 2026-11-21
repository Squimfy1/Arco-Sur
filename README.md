# Arco-Sur

Moving USDC on the Arc testnet with a guard that decides before anything is
signed, and a log that is checked against the chain afterwards.

Written in TypeScript. The last Python version is kept at the git tag
`python-v1`.

## Layout

```
src/lib/server/   the backend: reads the chain and the log, holds the key
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
  view.ts         turns chain + log readings into the screens' data
  review.ts       the Send screen's Review: guard + rehearsal, never signs
  memo.ts         remembers chain answers that can no longer change
src/lib/contract.ts  the data the backend hands the screens; types only
src/lib/ui/       the look: theme.css (every colour and size), the Cathedral
                  cross and images, the mosaic wall, components
src/routes/       the screens (SvelteKit): Portfolio, Operations, Send,
                  Receive, Swap, Rules; +layout.server.ts reads for all of them
electron/         the desktop app: main.js runs the screens with no network port
tests/      offline tests: guard, intents, refusals, reconciliation, reads,
            screens, review, and that the look and the backend stay apart
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

### The desktop app

```
npm run install-app   # builds Cathedral.app and puts it in ~/Applications
npm run app           # or: build and open it straight from the repo
```

The app is branded **Cathedral**, in the Cathedral Library UI system: grain
on near-black, Geist and Geist Mono, readout plates, "+" registration marks,
signal red only as a bloom or a 2 px line, and the Cathedral cross. Portfolio
opens on a mosaic wall: the cross set in small tiles that light up in
stained-glass colours where the pointer passes. Then the balance (cut to two
decimals; hover for the exact figure), the Send / Receive / Swap / Faucet /
Explorer buttons, the balance history, assets and latest operations. The
other screens are Operations (every send and refusal, by day, checked against
the chain), Send, Receive, Swap and Rules (limits as glass folders, and the
books as plates). The top bar shows whether the log reconciles, re-reads on
Refresh, and the eye hides every amount.

- **Send** checks a payment against the rules and rehearses it on the node,
  then shows the fee. It does not sign yet (Stage 10): `npm run send` does.
- **Swap** is laid out but switched off: the rules approve no one.
- **Faucet** and **Explorer** open in your normal browser.

Nothing listens on a network port, not even localhost: the window asks the
app for `arco://app/…`, and the app answers inside its own process. The
window has no access to Node, files or the key. The packaged app reads the
key and the log from this repo, whose path is recorded when it is built, so
rebuild it with `npm run install-app` after moving the repo.

**Changing the look.** Every colour, font and size is in
`src/lib/ui/theme.css`; components use only its variables. The backend sends
data only, typed in `src/lib/contract.ts`. `tests/decoupling.test.ts` fails
if the backend ever mentions a colour or a class, or a screen imports
backend code.

`npm run dev` serves the screens at http://127.0.0.1:5173 with hot reload,
for working on the look.

`account.ts` reads a throwaway testnet private key from `.testnet_key` in the
repo root. That file is gitignored. Never put a key holding real funds there.

## Progress

See [docs/PLAN.md](docs/PLAN.md) for what each stage built and how it was
tested.
