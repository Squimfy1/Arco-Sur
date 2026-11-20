# Arco-Sur

Moving USDC on the Arc testnet with a guard that decides before anything is
signed, and a log that is checked against the chain afterwards.

## Layout

```
src/        the code
  arc.py      talks to the Arc chain (read-only RPC)
  guard.py    the mandate: who may be paid, and how much
  send.py     the send loop; this is the file you run
tests/      offline tests for the guard
docs/       PLAN.md (the staged build plan) and notes/
evidence/   sends.jsonl, one line per send, never rewritten
scratch/    early experiments, not used by the code
```

## Run

```
pip install eth-account pytest

pytest              # 17 guard tests, no network
python src/send.py  # sends 0.1 USDC to your own wallet
```

`send.py` reads a throwaway testnet private key from `.testnet_key` in the
repo root. That file is gitignored. Never put a key holding real funds there.

## Progress

See [docs/PLAN.md](docs/PLAN.md). Stage 1 (send and verify) is done.
