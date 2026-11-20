# Arc build plan — every feature a crypto app needs, with its test

**Where we are.** TypeScript: `src/arc.ts` (RPC client), `src/guard.ts` (the
mandate), `src/send.ts` (the five-stage loop), `tests/guard.test.ts` (18
tests, 13 of them refusals) and `tests/send.test.ts` (2 tests: a refusal
never reaches the chain). Stages 1 and 2 are done. Ported from Python on
2026-11-20; the Python version is the git tag `python-v1`. Chain ID 5042002.

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

## Stage 3 · Reconciliation  ·  the employable one  ·  NEXT

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

---

## Stage 4 · Read a token balance (ERC-20)

**Concept: `eth_call` is a read with no transaction, no gas, no nonce.** You
execute a contract function locally on a node and throw the result away.

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

---

## Stage 5 · Send a token, and the approval trap

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

---

## Stage 6 · Simulate before send

**Concept: `eth_estimateGas` and `eth_call` tell you whether a transaction
would revert — before you spend anything.** Tenderly is a whole company built
on this idea, and it is on Arc's ecosystem list.

**Build:** a `simulate()` step inserted between guard approval and signing. If
the call reverts, abort and log the revert reason.

**Test:** send to a contract that will revert. The loop must stop at simulate
and never broadcast.

---

## Stage 7 · Events and logs

**Concept: contracts report what happened through logs, and a receipt's
`logs` array is the only proof of what a call actually did.** `status=1` means
it did not revert, not that it did what you wanted.

**Build:** parse the `Transfer` event from a receipt — topic0 is
`keccak("Transfer(address,address,uint256)")`, the two addresses are indexed
topics, the amount is in `data`.

**Test:** send a token, then prove from the receipt logs alone that the
recipient and amount match your intent. This closes the gap between *the
transaction succeeded* and *the money went where I meant*.

---

## Stage 8 · Gas, fees, and the cost of being wrong

**Concept: you pay for computation whether or not it succeeds.** A reverted
transaction still costs gas.

**Build:** record `gasUsed × effectiveGasPrice` per send into the log, in USDC.

**Test:** reconcile total fees paid against the balance delta that is not
explained by transfers. If they do not agree, something moved that you did not
record.

---

## Stage 9 · The interface, read-only

**Concept: the view renders, it never calculates.** Everything displayed comes
from the log or the chain.

**Build:** one HTML page — address, balance, send history with receipt status,
and the reconciliation result per row.

**Test:** `view_check.mjs` — assert no arithmetic in the template, and that
every number on screen traces to a value in the JSON.

---

## Stage 10 · Send from the interface

**Concept: the UI calls the same guard.** No second code path, no duplicated
rules.

**Test:** complete a send without touching the terminal, and confirm the log
line is identical in shape to a CLI send.

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

That is a crypto application's full read-write-verify surface, and every row
has a test. Stages 1 to 3 alone are a complete execution system and the part
that is defensible in an interview.

**Stage 1 needs a throwaway MetaMask account and ten minutes.** Everything
after it is unblocked.
