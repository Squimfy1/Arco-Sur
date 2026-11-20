/**
 * Stage 2: a refused payment is recorded, and never signed or broadcast.
 * Stage 6: a payment the chain would reject is stopped at simulation.
 *
 * The chain client is replaced with fakes that record every call, so the
 * test can prove the guard ran BEFORE anything touched the network. A
 * throwaway key and a temporary log file keep the real wallet and the real
 * evidence out of it.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("../src/lib/server/arc.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/server/arc.ts")>()),
  ask: vi.fn(),
  nonce: vi.fn(),
  gasPrice: vi.fn(),
  balanceWei: vi.fn(),
  receipt: vi.fn(),
  simulateCall: vi.fn(),
  estimateGas: vi.fn(),
}));

import * as arc from "../src/lib/server/arc.ts";
import { makeMandate } from "../src/lib/server/guard.ts";
import { send } from "../src/lib/server/send.ts";

// Private key 1: a famous test key that no one uses for real money.
const account = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
);
const STRANGER = "0x1111111111111111111111111111111111111111";

const mandate = makeMandate({
  allowedRecipients: [account.address],
  maxAmountUsdc: "1",
  maxTotalUsdc: "5",
  chainId: arc.CHAIN_ID,
});

let logFile: string;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  logFile = join(mkdtempSync(join(tmpdir(), "arco-sur-")), "sends.jsonl");
});

function logLines(): Record<string, unknown>[] {
  return readFileSync(logFile, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

test("a refused payment is logged with its reason and never reaches the chain", async () => {
  const result = await send(mandate, STRANGER, "0.1", { account, logFile });

  expect(result).toBeNull();

  // Nothing was asked of the chain: no rehearsal, no nonce, no price, no broadcast.
  expect(arc.simulateCall).not.toHaveBeenCalled();
  expect(arc.nonce).not.toHaveBeenCalled();
  expect(arc.gasPrice).not.toHaveBeenCalled();
  expect(arc.balanceWei).not.toHaveBeenCalled();
  expect(arc.ask).not.toHaveBeenCalled();

  const lines = logLines();
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ broadcast: false, to: STRANGER, amount_usdc: "0.1" });
  expect(lines[0]?.refused_because).toContain("allowlist");
  // If a hash appears, the guard ran too late.
  expect(lines[0]).not.toHaveProperty("tx_hash");
  expect(lines[0]).not.toHaveProperty("nonce");
});

test("control: an allowed payment does reach the chain, so the fakes would catch a leak", async () => {
  // Without this test, the one above could pass simply because the fakes
  // never record anything.
  vi.mocked(arc.simulateCall).mockResolvedValue("0x");
  vi.mocked(arc.nonce).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  vi.mocked(arc.gasPrice).mockResolvedValue(20_000_000_000n);
  vi.mocked(arc.balanceWei).mockResolvedValue(10n ** 21n);
  vi.mocked(arc.ask).mockResolvedValue("0xfeed");
  vi.mocked(arc.receipt).mockResolvedValue({ status: "0x1", gasUsed: "0x5208" });

  const result = await send(mandate, account.address, "0.1", { account, logFile });

  expect(result).toBe("0xfeed");
  expect(arc.simulateCall).toHaveBeenCalledOnce();
  expect(arc.ask).toHaveBeenCalledWith("eth_sendRawTransaction", [expect.stringMatching(/^0x/)]);
  expect(logLines()[0]).toMatchObject({ broadcast: true, tx_hash: "0xfeed", nonce: 0 });
});

test("Stage 8: once the receipt arrives, the outcome and its fee are appended", async () => {
  vi.mocked(arc.simulateCall).mockResolvedValue("0x");
  vi.mocked(arc.nonce).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  vi.mocked(arc.gasPrice).mockResolvedValue(25_000_000_000n);
  vi.mocked(arc.balanceWei).mockResolvedValue(10n ** 21n);
  vi.mocked(arc.ask).mockResolvedValue("0xfeed");
  vi.mocked(arc.receipt).mockResolvedValue({
    status: "0x1", gasUsed: "0x5208", effectiveGasPrice: "0x4a817c800", blockNumber: "0x10",
  });

  await send(mandate, account.address, "0.1", { account, logFile });

  const lines = logLines();
  expect(lines).toHaveLength(2);
  // 21000 gas × 20 gwei (what the chain charged, not the 25 gwei offered).
  expect(lines[1]).toMatchObject({
    type: "outcome", tx_hash: "0xfeed", nonce: 0, status: 1, block: 16, gas_used: 21000, fee_usdc: "0.00042",
  });
});

test("a payment the chain would reject is stopped at simulation and never signed", async () => {
  const reason = "execution reverted: insufficient funds";
  vi.mocked(arc.simulateCall).mockRejectedValue(new arc.RpcError(`eth_call: ${reason}`, { code: 3, message: reason }));

  const result = await send(mandate, account.address, "0.1", { account, logFile });

  expect(result).toBeNull();
  expect(arc.simulateCall).toHaveBeenCalledOnce();
  // Stopped before the nonce was read, so nothing could have been signed.
  expect(arc.nonce).not.toHaveBeenCalled();
  expect(arc.ask).not.toHaveBeenCalled();

  const lines = logLines();
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ broadcast: false, refused_because: `simulation: ${reason}` });
  expect(lines[0]).not.toHaveProperty("tx_hash");
});
