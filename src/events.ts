/**
 * Prove from a receipt's logs what a token call actually did.
 *
 * A receipt's status says only "did not revert". It does not say the money
 * went where you meant. A token contract reports every movement as an event
 * in the receipt's logs:
 *
 *   address     which contract emitted it (only the token itself is believed)
 *   topics[0]   which event: keccak256("Transfer(address,address,uint256)")
 *   topics[1]   from, left-padded to 32 bytes
 *   topics[2]   to, left-padded to 32 bytes
 *   data        the amount, a 32-byte number
 *
 * That layout is decoded by hand here, as balanceOf was encoded by hand in
 * read.ts, and tested equal to viem's decoder.
 *
 * On Arc a NATIVE USDC payment emits no event at all (checked live: its
 * receipt has no logs), so this applies to token calls only.
 */

import { keccak256, toHex } from "viem";

import { normalise } from "./guard.ts";

export const TRANSFER_TOPIC = keccak256(toHex("Transfer(address,address,uint256)"));
export const APPROVAL_TOPIC = keccak256(toHex("Approval(address,address,uint256)"));

/** The fields of a receipt log this file reads. The node sends more. */
export type Log = { address: string; topics: readonly string[]; data: string };

/** One token movement (or approval) as the token contract reported it. */
export type TokenEvent = {
  kind: "transfer" | "approve";
  token: string;
  from: string;   // for an approval: the owner
  to: string;     // for an approval: the spender
  amount: bigint;
};

/** An address stored in a 32-byte topic is its last 20 bytes. */
const topicAddress = (topic: string): string => `0x${topic.slice(-40).toLowerCase()}`;

/** Every ERC-20 Transfer and Approval in these logs, decoded. Anything else is skipped. */
export function decodeTokenEvents(logs: readonly Log[]): TokenEvent[] {
  const events: TokenEvent[] = [];
  for (const log of logs) {
    const [topic, a, b] = log.topics;
    // An ERC-721 (NFT) Transfer has the same signature but a 4th topic and
    // no data. Exactly 3 topics and a 32-byte amount is the ERC-20 shape.
    if (log.topics.length !== 3 || a === undefined || b === undefined || log.data.length !== 66) {
      continue;
    }
    const kind = topic === TRANSFER_TOPIC ? "transfer" : topic === APPROVAL_TOPIC ? "approve" : null;
    if (kind === null) {
      continue;
    }
    events.push({
      kind,
      token: log.address.toLowerCase(),
      from: topicAddress(a),
      to: topicAddress(b),
      amount: BigInt(log.data),
    });
  }
  return events;
}

export type Proof = { proven: true } | { proven: false; reason: string };

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Does the receipt prove exactly this effect: one event, emitted by the
 * token contract itself, with this sender, recipient and amount?
 */
export function proveEffect(logs: readonly Log[], expected: TokenEvent): Proof {
  const name = expected.kind === "transfer" ? "Transfer" : "Approval";
  const token = normalise(expected.token);
  const fromToken = decodeTokenEvents(logs).filter((e) => e.kind === expected.kind && e.token === token);

  if (fromToken.length === 0) {
    return { proven: false, reason: `no ${name} event from the token ${short(expected.token)}` };
  }

  const matching = fromToken.filter(
    (e) => e.from === normalise(expected.from) && e.to === normalise(expected.to) && e.amount === expected.amount,
  );
  if (matching.length === 1) {
    return { proven: true };
  }
  if (matching.length > 1) {
    return { proven: false, reason: `${matching.length} matching ${name} events: ambiguous, not proof of one` };
  }

  const seen = fromToken.map((e) => `${short(e.from)} -> ${short(e.to)} amount ${e.amount}`).join("; ");
  return {
    proven: false,
    reason: `expected ${name} ${short(expected.from)} -> ${short(expected.to)} amount ${expected.amount}, ` +
      `the token reported: ${seen}`,
  };
}
