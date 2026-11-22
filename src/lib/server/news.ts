/**
 * The Home screen's news: recent stories from companies on Arc's ecosystem
 * list (https://www.arc.io/ecosystem), checked on 21 Nov 2026. Each has its
 * source; summaries are written for this app, not copied. Topics are Arc's
 * own groups on that page.
 *
 * Kept here as data. The frontend picks each logo by slug and decides the
 * look; this file knows nothing about images or styling.
 */

import type { News, NewsItem } from "../contract.ts";

const ECOSYSTEM = "https://www.arc.io/ecosystem";
const CHECKED = "2026-11-21";

/** Arc's ecosystem groups, in the order its page lists them. */
const TOPICS = ["Issuers", "Infrastructure", "Developer Tools", "Trading", "Payments", "Financial Services"];

/** The kinds of news, biggest first. */
const KINDS = ["Product Launch", "Partnership", "Integration", "Funding", "News"];

/** As NewsItem, with the date as YYYY-MM-DD. */
const STORIES: NewsItem[] = [
  {
    company: "Visa",
    slug: "visa",
    topic: "Payments",
    kind: "Partnership",
    headline: "Visa Brings Stablecoin Payouts to Asia Pacific",
    summary: "Visa Direct clients in Asia Pacific can now prefund cross-border payouts with stablecoins while recipients still receive local currency. Singapore's dtcpay is the first pilot partner, following a US commercial launch of the service in October.",
    ticker: "Visa pilots stablecoin payouts in Asia",
    date: "2026-11-18",
    source: "https://theblock.co/news/business/2026-11-18-visa-direct-extend-stablecoin-prefunding-cross-border-payouts-asia-pacific-443457",
  },
  {
    company: "Securitize",
    slug: "securitize",
    topic: "Issuers",
    kind: "Product Launch",
    headline: "BUIDL Gets 24/7 Stablecoin Liquidity",
    summary: "Securitize and Ethena switched on a $100 million facility that lets eligible holders of BlackRock's BUIDL fund swap shares for stablecoins such as USDC at any hour. It opens with $50 million ready to use, and a further $50 million can be added within an hour.",
    ticker: "Securitize opens 24/7 BUIDL swaps",
    date: "2026-11-12",
    source: "https://theblock.co/news/ecosystems/2026-11-12-securitize-ethena-buidl-liquidity-facility-live-usdc-438442",
  },
  {
    company: "Aave",
    slug: "aave",
    topic: "Financial Services",
    kind: "News",
    headline: "Aave Sets Out Its Plans for Arc",
    summary: "Aave V4 has run on Arc since mainnet day with USDC, EURC, cirBTC and WETH, including a Forex market where dollars and euros can be borrowed against each other. Its business chief says tokenized stocks and non-dollar stablecoins are the next lending markets it wants to grow there.",
    ticker: "Aave eyes tokenized stocks on Arc",
    date: "2026-11-02",
    source: "https://www.arc.io/blog/why-aave-is-building-its-next-generation-of-markets-on-arc",
  },
  {
    company: "Coinbase",
    slug: "coinbase",
    topic: "Trading",
    kind: "News",
    headline: "Coinbase Profit Climbs 66% in Q3",
    summary: "Coinbase earned $719 million in the third quarter on $1.22 billion of revenue, even as trading volumes slipped. Stablecoin revenue rose to $328 million and its prediction markets business doubled to a $200 million yearly pace.",
    ticker: "Coinbase Q3 profit up 66% to $719M",
    date: "2026-10-30",
    source: "https://theblock.co/news/business/2026-10-30-coinbase-q3-net-income-jumps-432189",
  },
  {
    company: "Galaxy",
    slug: "galaxy",
    topic: "Trading",
    kind: "News",
    headline: "Galaxy Applies for US Trust Bank Charter",
    summary: "Galaxy asked the OCC for a national trust bank charter that would bring its custody, trading and staking services under one federal framework. If approved, Galaxy National Bank would operate from New York but could not take deposits or make commercial loans.",
    ticker: "Galaxy seeks national trust bank charter",
    date: "2026-10-29",
    source: "https://www.bankingdive.com/news/galaxy-digital-applies-occ-national-trust-bank-charter/873209/",
  },
  {
    company: "DTCC",
    slug: "dtcc",
    topic: "Infrastructure",
    kind: "Product Launch",
    headline: "DTCC Tokenization Service Goes Live",
    summary: "DTCC launched a service that issues tokenized versions of securities held at its DTC depository, keeping the same ownership rights and protections. It starts on the Canton Network and a private DTCC chain with 20 firms including J.P. Morgan, Citi and Fidelity, and more networks are planned for 2027.",
    ticker: "DTCC launches tokenized securities",
    date: "2026-10-28",
    source: "https://www.dtcc.com/press-releases/2026/dtcc-tokenization-service-goes-live",
  },
  {
    company: "MoonPay",
    slug: "moonpay",
    topic: "Payments",
    kind: "Product Launch",
    headline: "MoonPay Unifies Card and Crypto Deposits",
    summary: "MoonPay launched a deposits product that combines Apple Pay, Google Pay, cards, bank transfers and crypto in a single integration. Users can fund accounts from their own wallets or from major exchanges across chains such as Solana and Ethereum.",
    ticker: "MoonPay launches all-in-one deposits",
    date: "2026-10-27",
    source: "https://www.moonpay.com/newsroom/crypto-deposits",
  },
  {
    company: "Crossmint",
    slug: "crossmint",
    topic: "Developer Tools",
    kind: "Integration",
    headline: "Crossmint Brings Its Stablecoin Stack to Arc",
    summary: "Crossmint is preparing to bring its wallets, on and off ramps, compliance tools and agent payment APIs to Arc. The goal is to let fintech teams launch payment and remittance apps without stitching together many separate providers.",
    ticker: "Crossmint wallets and ramps coming to Arc",
    date: "2026-10-20",
    source: "https://www.arc.io/blog/how-crossmint-supports-stablecoin-apps-and-the-agentic-economy-on-arc",
  },
  {
    company: "Uniswap",
    slug: "uniswap",
    topic: "Trading",
    kind: "News",
    headline: "Uniswap Turns On Protocol Fees on Arc",
    summary: "Uniswap governance approved and executed a plan to switch on protocol fees for its v2, v3 and v4 pools on Arc. Fees collected there will feed the same UNI burn system already running on other chains.",
    ticker: "Uniswap fee switch goes live on Arc",
    date: "2026-10-05",
    source: "https://gov.uniswap.org/t/temp-check-protocol-fee-expansion-arc/26287",
  },
  {
    company: "Kraken",
    slug: "kraken",
    topic: "Trading",
    kind: "Integration",
    headline: "Kraken Opens USDC Transfers on Arc",
    summary: "Kraken now lets customers deposit and withdraw USDC directly over the Arc network. Trading through the Kraken app and Instant Buy will follow once liquidity conditions are met.",
    ticker: "Kraken adds USDC deposits on Arc",
    date: "2026-09-16",
    source: "https://blog.kraken.com/product/new-features/usdc-on-arc-deposits-and-withdrawals-now-available",
  },
  {
    company: "MetaMask",
    slug: "metamask",
    topic: "Developer Tools",
    kind: "Partnership",
    headline: "Arc Picks MetaMask as Default Wallet",
    summary: "Arc named MetaMask its default wallet for onboarding users and developers ahead of mainnet. MetaMask comes set up for Arc on browser and mobile, with native USDC display and built-in bridging.",
    ticker: "MetaMask becomes the Arc default wallet",
    date: "2026-09-15",
    source: "https://cryptobriefing.com/arc-metamask-default-wallet-onboarding/",
  },
  {
    company: "Chainlink",
    slug: "chainlink",
    topic: "Developer Tools",
    kind: "Integration",
    headline: "Chainlink Price Feeds Reach Arc Mainnet",
    summary: "Chainlink made its Data Feeds available on Arc mainnet a week before the network opened to the public. Developers building lending, trading and payment apps on Arc can now read Chainlink price data onchain.",
    ticker: "Chainlink Data Feeds live on Arc",
    date: "2026-09-09",
    source: "https://dev.chain.link/changelog/data-feeds-expands-to-arc-mainnet",
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-18" as "18 Nov 2026". */
export function dayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** The stories, newest first, and the topics and kinds that have at least one. */
export function news(): News {
  const items = [...STORIES]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => ({ ...s, date: dayOf(s.date) }));
  return {
    topics: TOPICS.filter((t) => items.some((n) => n.topic === t)),
    kinds: KINDS.filter((k) => items.some((n) => n.kind === k)),
    items,
    asOf: dayOf(CHECKED),
    ecosystem: ECOSYSTEM,
  };
}
