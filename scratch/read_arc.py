import json, urllib.request

RPC = "https://rpc.testnet.arc.io"   # Arc testnet's front door
ME  = "0xCbEB3dcd3A96843b0324a983658bD31393466486"          # paste your MetaMask address

def ask(method, params):
    """Send one question to the chain and return its answer."""
    q = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    req = urllib.request.Request(RPC, json.dumps(q).encode(),
                              {"Content-Type": "application/json",
                               "User-Agent": "arco-sur/0.1"})
    return json.load(urllib.request.urlopen(req))["result"]

# Question 1: what block are we on?
block = int(ask("eth_blockNumber", []), 16)
print("current block:", block)

# Question 2: how much USDC does my address hold?
raw = int(ask("eth_getBalance", [ME, "latest"]), 16)
print("my balance:", raw / 10**18, "USDC")