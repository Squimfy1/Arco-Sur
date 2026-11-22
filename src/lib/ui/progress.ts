// Follow a send or a swap as it happens: post to the backend, then read its
// answer line by line, one Progress event per line, as each arrives.

import type { Progress } from "../contract.ts";

export async function follow(url: string, body: unknown, on: (p: Progress) => void): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch (e) {
    on({ type: "done", ok: false, status: "Not Sent", summary: `The app's server did not answer: ${(e as Error).message}`, link: null });
    return;
  }
  if (!response.ok || response.body === null) {
    const said = (await response.json().catch(() => null)) as { error?: string } | null;
    on({ type: "done", ok: false, status: "Not Sent", summary: said?.error ?? `The app's server said ${response.status}.`, link: null });
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += value;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) on(JSON.parse(line) as Progress);
  }
  if (pending.trim()) on(JSON.parse(pending) as Progress);
}
