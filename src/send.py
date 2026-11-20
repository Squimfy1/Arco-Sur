"""Send USDC on Arc. Guard decides, then sign, broadcast, verify.

The order is the whole point:

    1. guard.check()      decide BEFORE signing. No mandate, no transaction.
    2. nonce              read it once, reuse it on retry. This is the
                          protocol's idempotency key.
    3. sign + broadcast
    4. receipt            poll until mined. status 1 = success, 0 = reverted.
    5. reconcile          compare what was intended against what happened.

Step 5 exists because step 3 can time out after the transaction already
landed. A retry that re-signs with a NEW nonce sends the money twice. A retry
that reuses the SAME nonce cannot: the chain rejects the duplicate.

Key handling: the private key is read from a file that must be gitignored,
never from source, never from a chat. Use a throwaway testnet wallet.
"""

import json
import sys
import time
from decimal import Decimal
from pathlib import Path

from eth_account import Account

import arc
import guard

# Code lives in src/; the key and the evidence live at the repo root.
ROOT = Path(__file__).resolve().parent.parent
KEY_FILE = ROOT / ".testnet_key"
LOG_FILE = ROOT / "evidence" / "sends.jsonl"

# 21000 is the fixed cost of a plain value transfer.
GAS_LIMIT = 21000


def load_account():
    if not KEY_FILE.exists():
        sys.exit(
            f"No key at {KEY_FILE}.\n"
            "Create a THROWAWAY testnet wallet and put its private key there.\n"
            "Never use a key that holds real funds."
        )
    key = KEY_FILE.read_text().strip()
    if not key.startswith("0x"):
        key = "0x" + key
    return Account.from_key(key)


def log(record):
    """Append-only evidence. One JSON object per line, never rewritten."""
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a") as f:
        f.write(json.dumps(record, sort_keys=True) + "\n")


def already_sent(sender):
    """Total USDC this script has recorded as broadcast from this address."""
    if not LOG_FILE.exists():
        return Decimal("0")
    total = Decimal("0")
    for line in LOG_FILE.read_text().splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        if r.get("from", "").lower() == sender.lower() and r.get("broadcast"):
            total += Decimal(r["amount_usdc"])
    return total


def wait_for_receipt(tx_hash, timeout_s=120, interval_s=3):
    """Poll until mined. Returns None on timeout — UNKNOWN stays UNKNOWN."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = arc.receipt(tx_hash)
        if r is not None:
            return r
        time.sleep(interval_s)
    return None


def send(mandate, to, amount_usdc):
    acct = load_account()

    # 1. DECIDE FIRST. Nothing is signed until the mandate allows it.
    verdict = guard.check(
        mandate,
        to=to,
        amount_usdc=amount_usdc,
        chain_id=arc.CHAIN_ID,
        already_sent_usdc=already_sent(acct.address),
    )
    print(f"guard: {'ALLOW' if verdict.allowed else 'REFUSE'} — {verdict.reason}")
    if not verdict.allowed:
        log({
            "ts": time.time(), "from": acct.address, "to": to,
            "amount_usdc": str(amount_usdc), "broadcast": False,
            "refused_because": verdict.reason,
        })
        return None

    # 2. Nonce: read once. On retry this same value must be reused.
    n = arc.nonce(acct.address)
    price = arc.gas_price()
    value = guard.to_wei(amount_usdc)

    balance = arc.balance_wei(acct.address)
    cost = value + GAS_LIMIT * price
    if balance < cost:
        print(f"insufficient: have {guard.from_wei(balance)}, "
              f"need {guard.from_wei(cost)} incl gas")
        return None

    tx = {
        "to": to, "value": value, "gas": GAS_LIMIT,
        "gasPrice": price, "nonce": n, "chainId": arc.CHAIN_ID,
    }
    print(f"intent: {amount_usdc} USDC -> {to}  nonce={n}")

    # 3. Sign and broadcast.
    signed = acct.sign_transaction(tx)
    tx_hash = arc.ask("eth_sendRawTransaction",
                      ["0x" + signed.raw_transaction.hex().removeprefix("0x")])

    log({
        "ts": time.time(), "from": acct.address, "to": to,
        "amount_usdc": str(amount_usdc), "nonce": n,
        "tx_hash": tx_hash, "broadcast": True,
    })
    print(f"broadcast: {tx_hash}")

    # 4. Verify. What actually happened, not what was intended.
    r = wait_for_receipt(tx_hash)
    if r is None:
        print("receipt: UNKNOWN — still pending after timeout.")
        print(f"         Do NOT resend. Re-check with nonce {n}.")
        return tx_hash

    status = arc.to_int(r.get("status"))
    gas_used = arc.to_int(r.get("gasUsed"))
    print(f"receipt: status={status} "
          f"({'SUCCESS' if status == 1 else 'REVERTED'}) gasUsed={gas_used}")

    # 5. Reconcile: intended vs actual.
    if status == 1:
        after = arc.nonce(acct.address)
        print(f"reconcile: nonce {n} -> {after} "
              f"({'consistent' if after == n + 1 else 'UNEXPECTED'})")

    return tx_hash


if __name__ == "__main__":
    acct = load_account()
    me = acct.address
    print(f"address: {me}")
    print(f"balance: {guard.from_wei(arc.balance_wei(me))} USDC")

    # Mandate: this account may pay ITSELF, up to 1 USDC, 5 USDC total.
    mandate = guard.Mandate(
        allowed_recipients=frozenset({me}),
        max_amount_usdc=Decimal("1"),
        max_total_usdc=Decimal("5"),
        chain_id=arc.CHAIN_ID,
    )

    send(mandate, to=me, amount_usdc=Decimal("0.1"))
