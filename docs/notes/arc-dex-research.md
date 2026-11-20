# Arc DEX research — what exists, verified on-chain

_Notes only — nothing in this file is used by the code. Companion to
[dex-aggregator-idea.md](dex-aggregator-idea.md)._

Researched **2026-11-19**. Every "verified" item below was checked by calling the
contract directly through the Arc RPC, not just copied from a website. Testnet
prices move constantly — re-check before relying on any number.

## Network basics (Arc Testnet)

| | |
|---|---|
| Chain ID | `5042002` (mainnet is `5042`) |
| RPC | `https://rpc.testnet.arc.io` (mainnet: `https://rpc.mainnet.arc.io`) |
| Explorer | `https://explorer.testnet.arc.io` (has a Blockscout API at `/api/v2`) |
| Faucet | `https://faucet.circle.com` — gives USDC and EURC |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals as ERC-20; gas is also USDC) |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

Source: Arc docs contract-addresses page.

## The answer: yes, there are enough pools to aggregate

There are **4 independent venues with a live USDC/EURC market on testnet**, all of
different types — which is exactly the situation the video describes.

Snapshot of quotes for **1 unit in** (2026-11-19):

| Venue | Type | 1 USDC → EURC | 1 EURC → USDC | Liquidity |
|---|---|---|---|---|
| **Presto hub AMM** | custom | **0.9513** | 1.0448 | deep (~308k USDC / 54k EURC) |
| **Synthra V3** (0.05% pool) | Uniswap‑V3 fork | ~0.824 (estimate*) | ~1.21 (estimate*) | ~40k / 34k |
| **Synthra V3** (0.3% pool) | Uniswap‑V3 fork | ~0.820 (estimate*) | ~1.21 (estimate*) | very deep (~7.6M / 6.1M) |
| **Uniswap V2 fork (osr21)** | Uniswap‑V2 | 0.7643 | 1.2983 | ~1,268 / 973 |
| **ArcDEX** | single x·y=k pool | 0.0307 | **16.17** | tiny & lopsided (33 / 1.06) |

\* Synthra has no quote contract on testnet (see below); these are from the pool's
current price minus the fee — accurate for small trades only.

**Takeaways**

- Prices are wildly different between venues. That's testnet (nobody arbitrages), but
  it makes the aggregator's value very visible: best USDC→EURC is Presto, best
  EURC→USDC is ArcDEX (for tiny amounts) — no single pool wins both directions.
- ArcDEX's "16 USDC for 1 EURC" only works for very small trades; it has only 33 USDC
  in it, so a bigger trade would drain it and get a much worse price. An aggregator
  must quote the **actual amount**, not just 1 unit.

## Venue details

### 1. Presto hub AMM — verified ✅
- Contract: `0x5794a8284A29493871Fbfa3c4f343D42001424D6`
- Quote: `getQuote(address tokenIn, address tokenOut, uint256 amountIn) → uint256`
- Swap function: not yet identified (no published ABI). Source code is probably in
  `github.com/Emperoar07/Presto`. **To do before building.**
- Also lists USDT `0x175CdB1D338945f0D851A741ccF787D343E57952`, WUSDC, USYC pairs.

### 2. Synthra V3 (Uniswap‑V3 fork) — verified ✅, but no quoter
- Factory: `0x0fB6EEDA6e90E90797083861A75D15752a27f59c` (explorer names it `SynthraV3Factory`)
- Router: `0xA545bCB1Bd7985c59ea162aB1748A0803434C31b`
- USDC/EURC pools (found via `factory.getPool(USDC, EURC, fee)`):
  - 0.01%: `0x46c29547f4b75c9f18cec5b114cf3ce3231a66f8` (tiny)
  - 0.05%: `0xc4abb91884094972fc6634c0d91bb9f9332277f1`
  - 0.3%: `0x1c02648cf14ece64afc1af141c177760aec7013a` (deepest)
  - 1%: `0xff615e968e1d50980972b2e291571df2aef10919`
- **Problem:** no QuoterV2 contract found on testnet. Checked all ~36 contracts
  their deployer (`0x6063e834928EaC1ca47ac5Da27838079a103e305`) created — none quote.
  Its pool "init code hash" also doesn't match Synthra's published mainnet values.
- Options: (a) estimate from the pool's `slot0()` price — fine for small trades;
  (b) simulate the swap through the router with `eth_call`; (c) deploy our own small
  quoter contract. Decide at build time.
- Addresses came from a third-party file (`0xfinu/finu-tokens/chains.js`); Synthra's
  own docs only list mainnet. On-chain checks confirm they're real.

### 3. Uniswap V2 fork by osr21 — verified ✅
- Router: `0xe27d5d256b370604f1ff060fb489c6a8e3f8a6d9`
- Factory: `0x7483847d46db2920dd64efa676cf72dcf765814f` (620 pairs)
- USDC/EURC pair: `0xb3685D16AAa06361ED28377b1319136650Fa9A13`
- Quote: standard `getAmountsOut(uint256, address[])` — easiest of all to integrate.
- Swap: standard `swapExactTokensForTokens(...)`.
- Not official Uniswap; deployed by a community dev (osr21), who has since moved
  their own app to mainnet.

### 4. ArcDEX — verified ✅
- Contract: `0x1A142DF560a671c66c361A29a48Ab839Bc9F890E` (tokenA = USDC, tokenB = EURC)
- Quote: `getAmountOut(address tokenIn, uint256 amountIn) → uint256`
- Swap: `swap(address tokenIn, uint256 amountIn, uint256 minAmountOut)`
- A hobby project from a blog post; very little liquidity.

### Checked and ruled out
- **MINEPAD V2** (factory `0xB56B00C38EF85633A789644415A16b4C8ea12EF8`, router
  `0x54599C3e0bcb99ca37b286242b5eC5D331AB9D18`) — real, but **no USDC/EURC pair**.
- **Official Uniswap V3** — **mainnet only**; nothing deployed at those addresses on
  testnet.
- **Circle StableFX** (FxEscrow `0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10`) —
  request-for-quote system for approved market makers, not a pool you can just call.
- **Circle App Kit Swap** (`kit.estimateSwap` / `kit.swap`) — Circle's hosted routing
  service. Could be added as a "venue", but it's an API (not on-chain), needs a Node
  SDK + API key, and a public GitHub issue reports EURC→USDC has no route on testnet.

## Arc mainnet, for later (verified ✅)

Official Uniswap V3 is live on mainnet (chain 5042) with USDC/EURC pools at all four
fee tiers. Quoter works: 1 USDC → 0.9078 EURC (0.05% pool) vs 0.8942 (0.3% pool).

- Factory `0xf0db7b58379503491d857db50ac9ece64c653918`
- QuoterV2 `0x7dfd4f31be6814d2906bde155c3e1b146eac1468`
- SwapRouter02 `0x53bf6b0684ec7ef91e1387da3d1a1769bc5a6f77`
- Mainnet EURC is a **different address**: `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`
- Synthra V3.1 also lists mainnet contracts in its docs (not checked on-chain).

## What "Sauce" is

Almost certainly **Eco's Sauce SDK** (`eco.com/sauce`, `docs.eco.com/platform/sauce-sdk`).

- You write small programs in "SauceScript" (a subset of TypeScript) that run inside
  **one transaction**: read live pool prices, pick a route, and revert if the output
  is below your minimum.
- Its example recipes include "compare Uniswap V3 fee tiers and swap on the better
  quote", "split a swap across pools" and "try one venue, fall back to another" —
  i.e. the aggregator from the video.
- Supports Arc and Arc Testnet. npm package `@eco-incorp/sauce` (Node 24+).
  Proprietary licence, and executions pay a small "Kitchen" fee.
- It does **not** host apps. The tool that builds and deploys whole apps on Arc is
  Circle's **Arc Studio** (`studio.arc.io`) — the speaker may have blurred the two.
- Unknown: whether Sauce has ready-made modules for these specific testnet DEXs
  (Synthra/Presto/ArcDEX), or only for big ones like Uniswap V3.

## The "single-pool app" from the video

Not found. The closest official thing is Circle's sample app
`github.com/circlefin/arc-stablecoin-fx` (Next.js + Circle App Kit, USDC↔EURC on
testnet) — but it uses Circle's routing API, not a single pool, and needs several
Circle and Supabase API keys. We'll most likely build our own front end.

## Remaining gaps before building

1. Presto's **swap** function — read their GitHub source.
2. How to quote Synthra V3 on testnet (no quoter) — pick option (a), (b) or (c) above.
3. Decide: plain app that picks the best venue and calls it directly (simplest), or
   Sauce SDK for atomic on-chain routing.
4. Testnet USDC + EURC in our wallet from the faucet.

## Sources

- Arc docs: https://docs.arc.io/arc/references/contract-addresses
- App Kit swap: https://docs.arc.io/app-kit/quickstarts/swap-tokens-same-chain
- Circle sample app: https://github.com/circlefin/arc-stablecoin-fx (+ issue #1)
- Arc Swap / osr21 V2 & mainnet V3: https://github.com/circlefin/arc-node/issues/160
- ArcDEX: https://paragraph.com/@consumeobeydie/arcdex-first-amm-arc-testnet
- Presto: https://presto-42o.pages.dev/docs
- Synthra & MINEPAD testnet addresses: https://github.com/0xfinu/finu-tokens
- Synthra docs: https://docs.synthra.org/docs/contract-addresses
- Sauce SDK: https://eco.com/sauce, https://docs.eco.com/platform/sauce-sdk
- Arc Studio: https://developers.circle.com/ai/arc-studio
