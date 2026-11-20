# Arc build plan — every feature a crypto app needs, with its test

**Where we are.** The backend is done: Stages 1–8. TypeScript, chain ID
5042002, ported from Python on 2026-11-20 (the Python version is the git tag
`python-v1`). Next is the interface, Stages 9–10; Stage 11 (keystore) comes
before any real money.

| File | Job | Stage |
|---|---|---|
| `src/arc.ts` | RPC client: every question to the chain | 1, grown since |
| `src/account.ts` | loads the throwaway testnet key | 1 (moved in 5) |
| `src/guard.ts` | the mandate: recipients, limits, tokens, spenders | 1, 2, 5 |
| `src/intent.ts` | decodes what a transaction actually does | 5 |
| `src/simulate.ts` | rehearses a transaction before signing | 6 |
| `src/events.ts` | proves a token call from its receipt's events | 7 |
| `src/send.ts` | the pipeline: decode, guard, simulate, sign, verify, log | 1, 2, 5–8 |
| `src/reconcile.ts` | the log against the chain, and the money against the balance | 3, 5, 7, 8 |
| `src/contracts.ts` + `src/read.ts` | read any registered contract | 4 |

**The rule for the whole plan.** No stage is finished until its test passes.
The test comes first where it can. A stage you cannot test is a stage you do
not understand yet.

**The second rule.** Every stage adds *one* concept. If a stage needs two new
ideas, it is two stages.

---

## Stage 1 · Send and verify  ·  DONE

The complete loop for moving native USDC on Arc.

**Concept: the nonce is protocol-enforced idempotency.** Read it once, reuse
it on retry, and a double-send becomes impossible — the chain rejects the
second transaction with the same nonce.

**Build:** already written (`send.ts`). Guard decides → nonce read → sign →
broadcast → poll receipt → reconcile nonce advanced.

**Test:** a real send of 0.1 USDC to your own throwaway address, returning
`status=1`, plus one line appended to `evidence/sends.jsonl`.

**The case that matters:** timeout. If no receipt arrives in 120s it must
print `UNKNOWN` and say *do not resend*. Verify by setting the timeout to 1
second artificially — you should get `UNKNOWN`, never a guess.

**Result (2026-11-20):** four live sends, nonces 0–3, all `status=1`, all in
`evidence/sends.jsonl`. Timeout case run with the timeout forced to 0s: the
script printed `UNKNOWN` and *do not resend* for nonce 3, and the same
transaction was then found mined with `status=1` in block 73,202,353. That is
the double-send a blind retry would have caused.

**Re-verified after the TypeScript port (2026-11-20):** viem signs a test
transaction byte-for-byte identically to eth-account. Live send at nonce 4,
`status=1`. Timeout case at nonce 5: `UNKNOWN`, then found mined with
`status=1`. Log lines from both languages have the same shape.

---

## Stage 2 · The allowlist proves itself  ·  DONE

**Concept: a refusal is a feature, and it must be recorded.** Most wallets
have no concept of a forbidden destination.

**Build:** nothing new. Point `send.ts` at an address not on the mandate.

**Test:** the log gains a line with `verdict=REFUSE`, a stated reason, and
**no transaction hash**. If a hash appears, the guard ran too late.

**Result (2026-11-20):** `send.ts` now takes `--to` and `--amount`, so no code
is edited to point it elsewhere. Live run to `0x1111…1111`: `guard: REFUSE —
recipient not on the allowlist`, and the log gained a line with
`broadcast: false`, the reason in `refused_because`, and no `tx_hash` or
`nonce`. Nonce stayed at 6 and the balance was unchanged before and after,
and the refusal did not count toward the 5 USDC total (still 0.6).

Also an offline test, `tests/send.test.ts`, with the chain replaced by fakes
that record every call: a refused payment makes **zero** chain calls and
writes the refusal line. A control test proves the fakes do record a real
broadcast, and switching the allowlist check off makes the refusal test fail.

---

## Stage 3 · Reconciliation  ·  the employable one  ·  DONE

**Concept: two records of the same events, no shared clock, either may be
stale.** This is the distributed-data topic, and it is Roxom's posting
verbatim: *operational data vs ledgers vs provider statements*.

**Build `reconcile.ts`:** read `sends.jsonl`, and for every logged send fetch
the receipt from chain. Compare: did it land, does the amount match, is the
`to` address identical, are there nonce gaps, and does the sum of logged sends
equal the balance delta.

**Test, three cases:**
1. Clean log → reports `MATCHED` for every row.
2. Corrupt one amount by hand → reports `DIVERGENT` on that row only, and
   names both values.
3. Delete a line → reports a **nonce gap**, which is how you detect a send
   that happened but was never logged.

Case 3 is the important one. A log that only catches its own errors is not a
reconciler.

**Result (2026-11-20):** `npm run reconcile` checks every line against
`eth_getTransactionByHash` (who, to whom, how much, which nonce) and the
receipt (did it succeed), and labels it MATCHED, DIVERGENT, PENDING, MISSING,
REVERTED or REFUSED. Per sender it compares logged nonces with the chain's
count and reports gaps and duplicates. Exit code 1 when anything disagrees.

Live, on the real log: 6 matched, 1 refused, no gaps, `RECONCILED`. Live, on
copies (the real log is append-only and was not touched):
1. Clean → all `MATCHED`.
2. Nonce 2's amount changed to 0.5 → `DIVERGENT` on that line only:
   `amount: log 0.5 USDC, chain 0.1 USDC`.
3. Nonce 3's line deleted → `nonce gaps: 3 — on chain, NOT in the log`.

Offline: `tests/reconcile.test.ts`, 10 tests against a fake chain, covering
the three cases plus wrong recipient, unknown hash, pending, reverted,
duplicate nonce, and a refusal that is never looked up.

**Deferred to Stage 8:** "does the sum of logged sends equal the balance
delta". Every send so far went to this same wallet, so the only thing that
moves the balance is fees, and fees are Stage 8's concept. Incoming funds
(the faucet) also need a starting balance the log does not have.

---

## Stage 4 · Read any contract (tokens first)  ·  DONE

**Concept: `eth_call` is a read with no transaction, no gas, no nonce.** You
execute a contract function locally on a node and throw the result away.

*Widened on 2026-11-20 from "read a token balance" to "read any contract a
user needs on Arc": hand-encoding only works for simple argument types, so
it is done once to learn, and viem's ABI encoder does the rest.*

Selectors already computed:

| Signature | Selector |
|---|---|
| `balanceOf(address)` | `0x70a08231` |
| `decimals()` | `0x313ce567` |
| `transfer(address,uint256)` | `0xa9059cbb` |
| `approve(address,uint256)` | `0x095ea7b3` |

**Build:** `callContract(to, data)` in `arc.ts`, then `token_balance(token,
holder)` which ABI-encodes the address as 32 bytes.

**Test:** read `decimals()` from a token and assert it against the value the
explorer shows. **Never hardcode 18** — on Arc native USDC is 18 decimals and
everywhere else it is 6, which is a factor of a trillion waiting to happen.

**Result (2026-11-20):**
- `arc.ts` gains `call()` (eth_call) and `code()` (eth_getCode).
- `src/contracts.ts` is the registry: USDC, EURC, Permit2 and Multicall3,
  each with address and ABI, each checked live to hold code.
- `src/read.ts`: `encodeBalanceOf` by hand (tested equal to viem's encoder
  byte for byte), `readContract` for any function of any registered
  contract, and `tokenInfo` / `tokenBalance` which read `decimals()` and
  refuse anything outside 0–36. `npm run balances` prints them all.
- Refused, never turned into a number: an address with no code (which
  answers `"0x"` to everything, i.e. a fake zero balance), a contract that
  reverts, and an answer that does not decode against the ABI.

Live: USDC and EURC `decimals()` = 6. Native USDC 39.9972761908 (18
decimals) and token USDC 39.997276 (6 decimals) agree exactly once scaled:
39997276 = 39997276. Multicall3 `getChainId()` = 5042002, and Permit2
`allowance(me, USDC, me)` decodes all three return values. An empty address
and a different contract at `0x3600…0001` are both refused with a reason.
The selector table above was checked against keccak. 11 offline tests in
`tests/read.test.ts`.

**Deferred:** batching reads through Multicall3 `aggregate3` goes to Stage
9, where the page needs it; the address and ABI are already registered.

---

## Stage 5 · Send a token, and the approval trap  ·  DONE

**Concept: an ERC-20 transfer is a contract call, not a value transfer.** The
amount lives in the calldata, not in the `value` field. And `approve` grants
an **unlimited standing permission** unless you bound it.

**Build:** extend the guard so a token transfer is checked on the *decoded*
amount, not the transaction value. This is the real lesson: a guard that reads
`tx.value` would approve a transfer of a billion tokens because `value` is
zero.

**Test:** construct a transfer, decode your own calldata, assert the guard
sees the true amount. Then assert the guard **refuses** any `approve` with an
unbounded allowance.

**Result (2026-11-20):**
- `src/intent.ts` decodes any transaction's `{to, value, data}` into what it
  does: native payment, token transfer, token approval, or unknown. Unknown
  (including `transferFrom`, and value plus a call together) is refused.
- `guard.checkIntent` judges the decoded intent. The mandate gains token
  rules (EURC: 1 per payment, 5 total, 6 decimals) and `allowedSpenders`
  (none). Decimals read from the chain must equal the mandate's, or nothing
  is sent. USDC through its token contract counts against the same USDC
  limits as native sends. Approvals: never unbounded (≥ 2^255), only to a
  listed spender, never above one payment, and counted against the total.
- `send.ts`: one `execute()` pipeline for every send; `--token` and
  `--approve` on the command line. Token calls get an estimated gas limit
  plus 20%. Key loading moved to `src/account.ts`.
- `reconcile.ts` checks token lines by decoding the chain's calldata. Log
  lines for token calls add `kind`, `asset`, `token`, `decimals`, `amount`;
  native lines are unchanged.

Live: 0.1 USDC through the token contract to self, nonce 6, `status=1`,
42,694 gas, reconciled MATCHED from the decoded calldata. A billion EURC was
refused (`exceeds per-payment limit 1`) and an unlimited approval was refused
(`a standing permission to take everything`), both logged, neither signed.
18 offline tests in `tests/intent.test.ts` plus 4 token cases in the
reconciler; switching off the decoded-amount check fails the billion test.

---

## Stage 6 · Simulate before send  ·  DONE

**Concept: `eth_estimateGas` and `eth_call` tell you whether a transaction
would revert — before you spend anything.** Tenderly is a whole company built
on this idea, and it is on Arc's ecosystem list.

**Build:** a `simulate()` step inserted between guard approval and signing. If
the call reverts, abort and log the revert reason.

**Test:** send to a contract that will revert. The loop must stop at simulate
and never broadcast.

**Result (2026-11-20):** `src/simulate.ts` rehearses the whole transaction
(`eth_call` with from, to, value and data), then estimates gas for contract
calls (+20%). Plain payments keep the fixed 21,000. A token call must return
`true`: returning `false` or nothing is a failure even without a revert. A
node refusal becomes a logged reason (`refused_because: "simulation: …"`);
any other error (network down) is not swallowed. `RpcError` now keeps the
node's error object, so the reason is the chain's own words. `send.ts` runs
it after the guard and before the nonce is read.

Live: 0.5 EURC to self with 0 EURC held. The guard allowed it (within the
EURC rules); simulation stopped it with `execution reverted: ERC20: transfer
amount exceeds balance`. Nonce stayed 7 and the balance was unchanged. 6
offline tests in `tests/simulate.test.ts`, plus one in `send.test.ts`
proving a simulated revert never reaches the nonce or the broadcast.

Limit: a rehearsal runs against the state now. Another transaction can land
first and change it, so simulation catches "cannot work", not "will work".

---

## Stage 7 · Events and logs  ·  DONE

**Concept: contracts report what happened through logs, and a receipt's
`logs` array is the only proof of what a call actually did.** `status=1` means
it did not revert, not that it did what you wanted.

**Build:** parse the `Transfer` event from a receipt — topic0 is
`keccak("Transfer(address,address,uint256)")`, the two addresses are indexed
topics, the amount is in `data`.

**Test:** send a token, then prove from the receipt logs alone that the
recipient and amount match your intent. This closes the gap between *the
transaction succeeded* and *the money went where I meant*.

**Result (2026-11-20):** `src/events.ts` decodes ERC-20 `Transfer` and
`Approval` events by hand (tested equal to viem's decoder) and
`proveEffect()` demands exactly one event, emitted by the token contract
itself, with the expected sender, counterparty and amount. Lookalike events
from another contract, NFT transfers (4 topics), wrong amounts, missing
events and duplicates are all "not proof". `send.ts` prints the proof after
every token call; `reconcile.ts` marks a token line DIVERGENT if its receipt
lacks the proof, even with status 1.

Checked live: a NATIVE USDC payment on Arc emits no event (empty `logs`),
so this applies to token calls. Live: 0.1 USDC through the token contract,
nonce 7, printed `proof: the token's Transfer event matches exactly`, and
both token lines (nonces 6 and 7) reconcile MATCHED with event proof. 11
offline tests in `tests/events.test.ts` (one uses the real nonce-6 log), plus
one in the reconciler; dropping the "emitted by the token itself" check
makes the forged-event test fail.

---

## Stage 8 · Gas, fees, and the cost of being wrong  ·  DONE

**Concept: you pay for computation whether or not it succeeds.** A reverted
transaction still costs gas.

**Build:** record `gasUsed × effectiveGasPrice` per send into the log, in USDC.

**Test:** reconcile total fees paid against the balance delta that is not
explained by transfers. If they do not agree, something moved that you did not
record.

**Result (2026-11-20):**
- `send.ts` appends an **outcome line** once the receipt arrives: status,
  block, gas used and `fee_usdc` (gasUsed × effectiveGasPrice, paid whether
  it succeeded or not). A separate line, because the send line is written
  before the receipt exists and the log is never edited.
- `reconcile.ts` computes every row's fee from its receipt and checks any
  outcome line against it (fee, status, duplicates, orphans). Per sender it
  reads the native balance just before the first logged transaction
  (`eth_getBalance` at a past block; Arc's RPC keeps history) and now, and
  requires `start − fees − USDC sent to others = now`. USDC moved through
  its token contract counts as leaving the native balance. Any remainder is
  reported as unexplained and the run is NOT RECONCILED.
- This is the balance-delta check deferred from Stage 3.

Live: before any new send, 40 USDC at block 73,047,006, minus 8 fees
totalling 0.0045404389, equalled the balance exactly: unexplained 0. A new
send (nonce 8) wrote its outcome line (`fee_usdc: 0.0004305`) and the run
stayed RECONCILED. On a copy with nonce 3's line deleted, the reconciler
found it twice over: nonce gap 3, and `unexplained: -0.00042 USDC`, which is
exactly that transaction's fee. 10 offline tests in the reconciler (deposit,
payment to others, USDC via token, reverted fee, outcome mismatch, orphan,
no history) and one in `send.test.ts`.

---

## Stage 9 · The interface, read-only  ·  DONE

**Concept: the view renders, it never calculates.** Everything displayed comes
from the log or the chain.

**Build:** one HTML page — address, balance, send history with receipt status,
and the reconciliation result per row.

**Test:** `view_check.mjs` — assert no arithmetic in the template, and that
every number on screen traces to a value in the JSON.

**Result (2026-11-20):**
- Built with SvelteKit 3 (Svelte 5, Vite 8, adapter-node). `npm run app`
  serves it on 127.0.0.1:5173 only. The backend moved to `src/lib/server/`,
  which SvelteKit refuses to bundle for the browser: the key, the RPC and the
  log stay on the server. The CLIs run from there unchanged.
- `paths.ts` finds the repo root by its package.json, so the key and the log
  are the same files whether the code runs from source or bundled.
  `mandate.ts` holds the one mandate the CLI and the page both read.
- `+page.server.ts` reads the chain and the log with the CLI's own code
  (balances, `reconcile`, `alreadySent`) and hands the readings to
  `view.ts`'s `buildView`, which decides every string on the page: amounts
  (bigint, grouped), dates, statuses, mandate used/left and the bar's width,
  the accounting statement. `+page.svelte` only places them.
- Design: a Monitor surface (look first; the one Act, sending, comes in
  Stage 10). Dense and left-aligned: header with wallet, network, block, read
  time; a one-line verdict; Holdings and Mandate side by side; Activity, newest
  first; the Accounting statement. IBM Plex Sans with Plex Mono for numbers and
  addresses, oklch tokens with light and dark themes, status always a word as
  well as a colour. The design pack's slop diagnostic, scored against the
  page: 0 of 10 tells. No gradient; no blue/purple tech hue (warm paper, one
  rust accent); no tile grid (tables); no accent rail; no blur; no monument
  stat (the balance is a table row); no icon toppers; nothing centred; Plex,
  not a default font; the surface is a monitor and reads as one.
- Errors render as a page: no key file (503) or the node not answering (502),
  with the server's own message, which never contains the key.

Tests: `tests/view.test.ts`, 12 offline tests. `buildView` on fake readings
(grouping, holdings check, mandate usage, ordering, refusals, unbounded
amounts, the statement turning red). The template: no arithmetic or
formatting in any `{…}` expression, and no imports but its own types. The
page rendered for real with `svelte/server`: every number in its text is
found in the view object. Each check has a control. Mutation check: putting
`{Number(l.total) - Number(l.used)}` in the template failed the arithmetic
test; appending a digit to a value failed the trace test.

Live: the page shows nonces 0–8 Matched, 4 refusals with their reasons,
39.9950290611 USDC, 0.9 of 5 USDC used, and unexplained 0, the same as
`npm run reconcile` and `npm run balances`. It renders in about 1.2 s and
fits a 390 px phone (the activity table scrolls inside its own box).

---

## Stage 10 · Send from the interface  ·  NEXT

**Concept: the UI calls the same guard.** No second code path, no duplicated
rules.

**Test:** complete a send without touching the terminal, and confirm the log
line is identical in shape to a CLI send.

---

## Stage 11 · Keystore  ·  before any real money

**Concept: the key is the wallet.** Today `.testnet_key` is plain text, so
anyone who reads that one file skips the guard entirely. Deferred on purpose
while this is testnet-only; it must be done before a key holding real funds
goes anywhere near this code.

**Build:** `src/keystore.ts` writes and reads the standard v3 keystore
(scrypt + AES-128-CTR + keccak MAC), using Node's crypto and viem's keccak,
no new packages. `npm run keystore:create` converts `.testnet_key` once and
re-opens the result to check the address. `send.ts` asks for the password
with a hidden prompt and keeps the key in memory only. Then `.testnet_key` is
deleted.

**Test:** the official test vector from the Ethereum keystore spec decrypts
to its known key; a round trip returns the same key; a wrong password is
refused; the file contains no plaintext key; two encryptions of the same key
differ. Live: one send unlocked by password.

This also feeds the Stage 10 choice: a server holding an encrypted keystore,
or MetaMask holding the key in its own vault and signing in the browser.

---

## Then one of two forks

**A · Write a contract.** Arc is EVM, so Solidity. The smallest useful one is
the evidence anchor from the original `arco-sur/README.md`: store a hash, emit
an event, nothing else. Teaches deployment, ABI, and the explorer.
Prerequisite: Foundry, and the Cyfrin courses in the parked Rust list.

**B · Swaps.** Uniswap V3 and V4, Curve and Aero Slipstream all deploy on Arc.
Teaches slippage, deadlines, and why a quote is not a fill — the thing you
have been told three times about spreads you cannot verify.

**Do A first.** A contract you wrote is a portfolio piece. A swap is a trade.

---

## What this adds up to

| Stage | Capability | Topic it teaches |
|---|---|---|
| 1 | move money, verify outcome | idempotency |
| 2 | refuse and record | authorisation |
| 3 | reconcile log vs chain | distributed state |
| 4 | read contract state | ABI encoding |
| 5 | token transfers, approvals | calldata, standing permissions |
| 6 | simulate | verify before you send |
| 7 | parse events | proof of effect |
| 8 | account for fees | cost accounting |
| 9 | render | view/compute separation |
| 10 | act from UI | one code path |
| 11 | encrypted key storage | the key is the wallet |

That is a crypto application's full read-write-verify surface, and every row
has a test. Stages 1 to 3 alone are a complete execution system and the part
that is defensible in an interview.

**Stage 1 needs a throwaway MetaMask account and ten minutes.** Everything
after it is unblocked.
