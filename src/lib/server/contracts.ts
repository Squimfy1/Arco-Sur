/**
 * The contracts on Arc testnet a user of this wallet needs, in one place.
 *
 * Each entry is a name, an address and an ABI (the contract's menu: which
 * functions exist and what types they take and return). Adding a contract
 * means adding an entry here; read.ts can then read any of its functions.
 *
 * Addresses from the Arc docs, checked on 2026-11-20 to hold contract code.
 */

import { type Abi, erc20Abi, parseAbi } from "viem";

export type KnownContract = Readonly<{
  name: string;
  address: `0x${string}`;
  abi: Abi;
  kind: "token" | "infrastructure";
  note: string;
}>;

// USDC is also Arc's native gas token. This address is its ERC-20 view of
// the same money: 6 decimals here, 18 for the native balance.
export const USDC = {
  name: "USDC",
  address: "0x3600000000000000000000000000000000000000",
  abi: erc20Abi,
  kind: "token",
  note: "the native gas token's ERC-20 view; 6 decimals",
} as const satisfies KnownContract;

export const EURC = {
  name: "EURC",
  address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  abi: erc20Abi,
  kind: "token",
  note: "Circle's euro stablecoin; the faucet gives it",
} as const satisfies KnownContract;

// Address from the Arc docs and Circle's cirBTC page (both 2026-11-21),
// checked on chain: symbol cirBTC, 8 decimals, like Bitcoin itself.
export const CIRBTC = {
  name: "cirBTC",
  address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
  abi: erc20Abi,
  kind: "token",
  note: "Circle Wrapped Bitcoin; 8 decimals; the faucet gives it",
} as const satisfies KnownContract;

// Signed, expiring spending approvals that DEXes use. Needed in Stage 5.
export const PERMIT2 = {
  name: "Permit2",
  address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  abi: parseAbi([
    "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
    "function DOMAIN_SEPARATOR() view returns (bytes32)",
  ]),
  kind: "infrastructure",
  note: "token approvals used by DEXes",
} as const satisfies KnownContract;

// Batches many reads into one request. Needed by the page in Stage 9.
// viem's built-in multicall3Abi has only 3 functions, so the standard
// interface is written out here.
export const MULTICALL3 = {
  name: "Multicall3",
  address: "0xcA11bde05977b3631167028862bE2a173976CA11",
  abi: parseAbi([
    "struct Call3 { address target; bool allowFailure; bytes callData; }",
    "struct Result { bool success; bytes returnData; }",
    "function aggregate3(Call3[] calls) payable returns (Result[] returnData)",
    "function getBlockNumber() view returns (uint256 blockNumber)",
    "function getChainId() view returns (uint256 chainid)",
    "function getCurrentBlockTimestamp() view returns (uint256 timestamp)",
    "function getEthBalance(address addr) view returns (uint256 balance)",
  ]),
  kind: "infrastructure",
  note: "many reads in one request",
} as const satisfies KnownContract;

// Circle's swap contract (App Kit Swap's "Adapter"). A swap is one call to
// execute(): it takes the input token, runs the signed route Circle's
// Stablecoin Service quoted, and pays the output to the beneficiaries named
// in the call. The wallet's rules let it take exactly one swap's amount.
// Address from the SDK (@circle-fin/adapter-viem-v2, ADAPTER_CONTRACT_EVM_TESTNET),
// checked on chain on 2026-11-21 to hold contract code.
export const SWAP_ADAPTER = {
  name: "Circle Swap Adapter",
  address: "0xBBD70b01a1CAbc96d5b7b129Ae1AAabdf50dd40b",
  abi: [
    {
      type: "function",
      name: "execute",
      stateMutability: "payable",
      outputs: [],
      inputs: [
        {
          name: "params",
          type: "tuple",
          components: [
            {
              name: "instructions",
              type: "tuple[]",
              components: [
                { name: "target", type: "address" },
                { name: "data", type: "bytes" },
                { name: "value", type: "uint256" },
                { name: "tokenIn", type: "address" },
                { name: "amountToApprove", type: "uint256" },
                { name: "tokenOut", type: "address" },
                { name: "minTokenOut", type: "uint256" },
              ],
            },
            { name: "tokens", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "beneficiary", type: "address" }] },
            { name: "execId", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "metadata", type: "bytes" },
          ],
        },
        {
          name: "tokenInputs",
          type: "tuple[]",
          components: [
            { name: "permitType", type: "uint8" },
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "permitCalldata", type: "bytes" },
          ],
        },
        { name: "signature", type: "bytes" },
      ],
    },
  ],
  kind: "infrastructure",
  note: "Circle's swap contract; the one spender the rules allow",
} as const satisfies KnownContract;

export const CONTRACTS: readonly KnownContract[] = [USDC, EURC, CIRBTC, PERMIT2, MULTICALL3, SWAP_ADAPTER];
export const TOKENS: readonly KnownContract[] = CONTRACTS.filter((c) => c.kind === "token");
