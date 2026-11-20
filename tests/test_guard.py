"""Tests for the mandate. No network, no keys, no chain.

The important tests are the refusals. A guard that only proves it permits
good payments has not been tested at all.
"""

from decimal import Decimal

import pytest

from guard import (
    ARC_USDC_DECIMALS,
    Mandate,
    check,
    from_wei,
    normalise,
    to_wei,
)

ALICE = "0x1111111111111111111111111111111111111111"
BOB = "0x2222222222222222222222222222222222222222"
ARC = 5042002


def mandate():
    return Mandate(
        allowed_recipients=frozenset({ALICE}),
        max_amount_usdc=Decimal("5"),
        max_total_usdc=Decimal("20"),
        chain_id=ARC,
    )


# --- the happy path, one test ---------------------------------------------

def test_payment_within_mandate_is_allowed():
    v = check(mandate(), to=ALICE, amount_usdc=Decimal("1"), chain_id=ARC)
    assert v.allowed
    assert v.reason == "within mandate"


# --- the refusals, which are the point ------------------------------------

def test_unknown_recipient_refused():
    v = check(mandate(), to=BOB, amount_usdc=Decimal("1"), chain_id=ARC)
    assert not v.allowed
    assert "allowlist" in v.reason


def test_amount_over_per_payment_limit_refused():
    v = check(mandate(), to=ALICE, amount_usdc=Decimal("5.01"), chain_id=ARC)
    assert not v.allowed
    assert "per-payment limit" in v.reason


def test_exactly_at_limit_is_allowed():
    """Boundary: <= passes, > fails. Off-by-one here is a real bug."""
    assert check(mandate(), to=ALICE, amount_usdc=Decimal("5"), chain_id=ARC)


def test_cumulative_limit_refused():
    v = check(
        mandate(),
        to=ALICE,
        amount_usdc=Decimal("5"),
        chain_id=ARC,
        already_sent_usdc=Decimal("16"),
    )
    assert not v.allowed
    assert "cumulative" in v.reason


def test_wrong_chain_refused():
    """A mainnet transaction must not pass a testnet mandate."""
    v = check(mandate(), to=ALICE, amount_usdc=Decimal("1"), chain_id=1)
    assert not v.allowed
    assert "wrong chain" in v.reason


def test_zero_and_negative_refused():
    for bad in (Decimal("0"), Decimal("-1")):
        v = check(mandate(), to=ALICE, amount_usdc=bad, chain_id=ARC)
        assert not v.allowed


def test_float_amount_refused():
    """Floats are rejected outright: 0.1 + 0.2 != 0.3 and money is exact."""
    v = check(mandate(), to=ALICE, amount_usdc=1.0, chain_id=ARC)
    assert not v.allowed
    assert "Decimal" in v.reason


def test_malformed_addresses_refused():
    for bad in ("0x123", "", None, "nonsense", ALICE[:-1] + "g", 42):
        v = check(mandate(), to=bad, amount_usdc=Decimal("1"), chain_id=ARC)
        assert not v.allowed, f"{bad!r} should have been refused"


def test_case_does_not_bypass_the_allowlist():
    v = check(mandate(), to=ALICE.upper().replace("0X", "0x"),
              amount_usdc=Decimal("1"), chain_id=ARC)
    assert v.allowed


# --- a mandate that permits nothing is a configuration error --------------

def test_empty_allowlist_rejected_at_construction():
    with pytest.raises(ValueError):
        Mandate(
            allowed_recipients=frozenset(),
            max_amount_usdc=Decimal("1"),
            max_total_usdc=Decimal("1"),
            chain_id=ARC,
        )


def test_total_below_per_payment_rejected():
    with pytest.raises(ValueError):
        Mandate(
            allowed_recipients=frozenset({ALICE}),
            max_amount_usdc=Decimal("10"),
            max_total_usdc=Decimal("5"),
            chain_id=ARC,
        )


# --- unit conversion: Arc USDC is 18 decimals, not the usual 6 ------------

def test_arc_usdc_is_eighteen_decimals():
    assert ARC_USDC_DECIMALS == 18
    assert to_wei(Decimal("1")) == 10 ** 18


def test_wei_round_trip():
    for v in ("1", "0.5", "40", "0.000000000000000001"):
        assert from_wei(to_wei(Decimal(v))) == Decimal(v)


def test_float_rejected_by_to_wei():
    with pytest.raises(TypeError):
        to_wei(1.5)


def test_sub_wei_amount_rejected():
    with pytest.raises(ValueError):
        to_wei(Decimal("0.0000000000000000001"))


def test_normalise_returns_none_not_garbage():
    assert normalise("0xdeadbeef") is None
    assert normalise(None) is None
