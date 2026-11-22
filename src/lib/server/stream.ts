/**
 * A send or swap as a stream: one JSON line per Progress event, written the
 * moment it happens, so the screen moves with the chain instead of waiting
 * for the end. One at a time: a second request while one runs is refused,
 * because two sends at once would race for the same nonce.
 */

import type { Progress } from "../contract.ts";

let busy = false;

export function progressStream(work: (emit: (p: Progress) => void) => Promise<void>): Response {
  if (busy) {
    return Response.json({ error: "Another send or swap is still running. Wait for it to finish." }, { status: 409 });
  }
  busy = true;
  const encoder = new TextEncoder();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (p: Progress) => {
        if (!open) return; // the window went away; the work carries on
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(p)}\n`));
        } catch {
          open = false;
        }
      };
      work(emit)
        .catch((e: unknown) => {
          emit({ type: "fail", id: "", reason: `Stopped by an error: ${(e as Error).message}` });
          emit({ type: "done", ok: false, status: "Error", summary: "Check Operations before trying again.", link: null });
        })
        .finally(() => {
          busy = false;
          if (open) controller.close();
        });
    },
    cancel() {
      open = false;
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
