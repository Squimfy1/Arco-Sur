# Idea: turn a single-pool swap app into a DEX aggregator on Arc

_Notes only — nothing in this file is used by the code._

## Where the idea came from

From a video about building on Arc (paraphrased):

> The swap app you built is tied to a single pool. What we do in production is keep
> the same front end, but write the source script so it knows about that pool **and
> all the other DEX pools available on Arc**. When you swap, it picks the best one.
> That's an aggregator — you can build one in under ~300 lines and deploy it as an app
> (the speaker said "using Sauce" — not sure what tool that refers to; check the video).

## The idea in plain words

A normal swap app sends your trade to one pool. Whatever price that pool gives, you get.

An aggregator asks *every* pool "how much would I get for this trade?", compares the
answers, and sends the trade to whichever pool gives the most. Same buttons for the
user, better price on average.

```
            ┌─► Pool A quote: 99.10 EURC
user: swap ─┼─► Pool B quote: 99.42 EURC   ◄── best → execute here
100 USDC    └─► Pool C quote: 98.95 EURC
```

## Why it's feasible in ~300 lines

Almost all the work is things we already know how to do in `read_arc.py`:

1. **Asking for quotes is just reading the chain.** Each DEX has a read-only function
   that says "if you put in X, you'd get Y" (e.g. `getAmountsOut` on Uniswap‑v2‑style
   routers, a `Quoter` contract on v3‑style DEXs, `get_dy` on Curve‑style pools).
   Calling it is an `eth_call` — the same kind of JSON-RPC request as our `ask()`
   helper. It's free and doesn't need a signature.
2. **Comparing is a `max()`.** Pick the pool with the biggest output.
3. **Executing is the swap the app already does** — just pointed at the winning
   pool/router instead of a hard-coded one.

So the new code is mostly: a list of pools + one small "quote" adapter per DEX type +
the comparison. That's why it's short.

## How to do it — step by step

1. **Make a list of pools.** For each token pair we care about (e.g. USDC/EURC), write
   down every pool on Arc testnet: DEX name, DEX type (v2 / v3 / stable), router
   address, pool address, fee tier. Start with a hard-coded list; later this could be
   read from each DEX's factory contract.
2. **Write one quote function per DEX type.** Each takes `(tokenIn, tokenOut, amountIn)`
   and returns `amountOut` via `eth_call`. Different DEX types have different function
   names/arguments, which is the main fiddly bit.
3. **Quote all pools at once** (in parallel if possible) when the user types an amount.
   Skip any pool that errors or has too little liquidity.
4. **Pick the best.** Highest `amountOut`. Optionally subtract the gas cost of that
   route (gas on Arc is paid in USDC, so it's easy to compare like-for-like).
5. **Show the user** which pool won and the expected output — nice to show the
   runners-up too, so they can see the saving.
6. **Execute on the winner.** Approve the token for *that* router (each router needs
   its own approval), then send the swap with a **minimum output** (slippage limit,
   e.g. 0.5% below the quote) so the trade fails rather than fills at a bad price if
   the pool moves between quote and execution.

## Things to watch out for

- **Quotes go stale.** Prices can change between quoting and the swap landing — that's
  what the minimum-output/slippage setting protects against.
- **Only trust known pool addresses.** Anyone can deploy a fake pool; keep the list
  curated.
- **Approvals per router.** Switching pools means possibly a new approval transaction.
- **Front-end routing vs. on-chain routing.** The simple version (above) decides in the
  app and calls the winning DEX directly. Production aggregators often use their own
  on-chain router contract that quotes and swaps in one transaction (atomic, one
  approval) — more work, not needed for a first version.

## Possible next steps (later)

- **Split routing:** send part of a large trade to each of several pools when that
  beats putting it all in one (big trades move a single pool's price a lot).
- **Multi-hop:** USDC → X → EURC when there's no good direct pool.
- **Auto-discover pools** from DEX factory contracts instead of a hard-coded list.

## Open questions — answered 2026-11-19

See [arc-dex-research.md](arc-dex-research.md) for details and addresses.

- **Which DEXs/pools exist on Arc testnet?** Four with live USDC/EURC markets: Presto,
  Synthra V3, a Uniswap V2 fork, and ArcDEX. All verified on-chain.
- **What is "Sauce"?** Almost certainly Eco's Sauce SDK, which does on-chain routing
  ("compare pools, pick the best, enforce a minimum output") in one transaction.
- **Where is the "single-pool app"?** Not found; we'll build our own front end.
