"""Arc RPC client. Read-only calls.

One lesson baked in: Arc's edge rejects Python's default User-Agent with
HTTP 403. The UA below is required, not cosmetic.
"""

import json
import urllib.request

RPC = "https://rpc.testnet.arc.io"
CHAIN_ID = 5042002

# Arc rejects the default python-urllib User-Agent with 403.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)


class RpcError(RuntimeError):
    pass


def ask(method, params=None, timeout=25):
    """Make one JSON-RPC call. Returns the `result` field.

    Raises RpcError if the node returns an error object, so a failure is
    never silently treated as a value.
    """
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}
    ).encode()

    req = urllib.request.Request(
        RPC,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.load(resp)

    if "error" in payload:
        raise RpcError(f"{method}: {payload['error']}")

    return payload.get("result")


def to_int(hex_str):
    """0x hex string to int. None stays None, so UNKNOWN stays UNKNOWN."""
    if hex_str is None:
        return None
    return int(hex_str, 16)


# --- the four calls the execution loop needs -------------------------------

def block_number():
    return to_int(ask("eth_blockNumber"))


def balance_wei(address):
    return to_int(ask("eth_getBalance", [address, "latest"]))


def nonce(address):
    """Transactions already sent from this address.

    This is the protocol's own idempotency counter: transaction N cannot be
    mined twice, and cannot be mined before N-1.
    """
    return to_int(ask("eth_getTransactionCount", [address, "latest"]))


def gas_price():
    return to_int(ask("eth_gasPrice"))


def receipt(tx_hash):
    """None while pending. Once mined: status 1 = success, 0 = reverted."""
    return ask("eth_getTransactionReceipt", [tx_hash])
