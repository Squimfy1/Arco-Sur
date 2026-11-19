"""The mandate. What this account is permitted to do.

The pattern is taken from dHedge/Chamber's V2-Public contracts, which hold
~$23.5M behind it: the money sits somewhere whose own rules decide which
outbound calls are legal. The signer is not trusted; the boundary is.

dHedge splits this two ways and both are needed:

  assetGuards    - what may be HELD
  contractGuards - what may be CALLED

Here that becomes allowed_recipients (who may receive) and limits (how much,
how often). Pure functions, no network, no signing. Fully testable offline.
"""

from dataclasses import dataclass, field
from decimal import Decimal

# USDC is the native gas token on Arc and uses 18 decimals here.
# On every other chain USDC is 6 decimals. Getting this wrong is a
# factor-of-a-trillion error, so it lives in one named place.
ARC_USDC_DECIMALS = 18
WEI_PER_USDC = 10 ** ARC_USDC_DECIMALS


@dataclass(frozen=True)
class Mandate:
    """What the signer may do. Frozen: a mandate is not edited mid-run."""

    allowed_recipients: frozenset = field(default_factory=frozenset)
    max_amount_usdc: Decimal = Decimal("0")
    max_total_usdc: Decimal = Decimal("0")
    chain_id: int = 0

    def __post_init__(self):
        if self.max_amount_usdc <= 0:
            raise ValueError("max_amount_usdc must be positive")
        if self.max_total_usdc < self.max_amount_usdc:
            raise ValueError("max_total_usdc cannot be below max_amount_usdc")
        if not self.allowed_recipients:
            raise ValueError("a mandate with no allowed recipients permits nothing")


@dataclass(frozen=True)
class Verdict:
    """Binary. Allowed or not, with the reason stated."""

    allowed: bool
    reason: str

    def __bool__(self):
        return self.allowed


def normalise(address):
    """Lowercase an address for comparison. Never use for display."""
    if not isinstance(address, str):
        return None
    a = address.strip().lower()
    if not a.startswith("0x") or len(a) != 42:
        return None
    try:
        int(a, 16)
    except ValueError:
        return None
    return a


def check(mandate, *, to, amount_usdc, chain_id, already_sent_usdc=Decimal("0")):
    """Decide whether one payment is permitted. Returns a Verdict.

    Every rejection names its own reason. An unparseable input is rejected,
    never coerced into something that looks valid.
    """
    dest = normalise(to)
    if dest is None:
        return Verdict(False, f"malformed recipient address: {to!r}")

    if chain_id != mandate.chain_id:
        return Verdict(
            False,
            f"wrong chain: transaction is for {chain_id}, "
            f"mandate permits {mandate.chain_id}",
        )

    if not isinstance(amount_usdc, Decimal):
        return Verdict(False, "amount must be a Decimal, not float")

    if amount_usdc <= 0:
        return Verdict(False, f"amount must be positive, got {amount_usdc}")

    allowed = {normalise(a) for a in mandate.allowed_recipients}
    if dest not in allowed:
        return Verdict(False, f"recipient not on the allowlist: {dest}")

    if amount_usdc > mandate.max_amount_usdc:
        return Verdict(
            False,
            f"amount {amount_usdc} exceeds per-payment limit "
            f"{mandate.max_amount_usdc}",
        )

    running = already_sent_usdc + amount_usdc
    if running > mandate.max_total_usdc:
        return Verdict(
            False,
            f"cumulative {running} would exceed total limit "
            f"{mandate.max_total_usdc}",
        )

    return Verdict(True, "within mandate")


def to_wei(amount_usdc):
    """USDC Decimal to wei int. Exact: no float ever touches a value."""
    if not isinstance(amount_usdc, Decimal):
        raise TypeError("pass a Decimal, not a float")
    wei = amount_usdc * WEI_PER_USDC
    if wei != wei.to_integral_value():
        raise ValueError(f"{amount_usdc} USDC is not a whole number of wei")
    return int(wei)


def from_wei(wei):
    """wei int to USDC Decimal."""
    if wei is None:
        return None
    return Decimal(wei) / WEI_PER_USDC
