/**
 * The Home news: data from the backend, logos in the frontend, and the
 * screen draws what the backend sent.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { render } from "svelte/server";
import { expect, test, vi } from "vitest";

vi.mock("$app/state", () => ({ page: { url: new URL("arco://app/") } }));

import { dayOf, news } from "../src/lib/server/news.ts";
import Home from "../src/routes/+page.svelte";

const LOGOS = readdirSync(join(import.meta.dirname, "../src/lib/ui/news")).map((f) => f.replace(/\.\w+$/, ""));

test("every story has two sentences, a source, a known kind and an Arc topic", () => {
  const { items, topics } = news();
  expect(items.length).toBeGreaterThanOrEqual(10);
  for (const n of items) {
    // Initials such as "J.P." are not sentence ends.
    const sentences = n.summary.replace(/\b(?:[A-Z]\.){2,}/g, "X").match(/[.!?](\s|$)/g);
    expect(sentences?.length, n.company).toBe(2);
    expect(n.source).toMatch(/^https:\/\//);
    expect(["Product Launch", "Partnership", "Integration", "Funding", "News"]).toContain(n.kind);
    expect(topics).toContain(n.topic);
    expect(`${n.headline} ${n.summary} ${n.ticker}`).not.toMatch(/[·—]/);
  }
  expect(topics).toEqual(["Issuers", "Infrastructure", "Developer Tools", "Trading", "Payments", "Financial Services"]);
  // Every kind a story has is offered as a filter, and only those.
  expect(news().kinds).toEqual(["Product Launch", "Partnership", "Integration", "News"]);
});

test("every company's logo is in the frontend, under the slug the backend sends", () => {
  for (const n of news().items) expect(LOGOS, n.slug).toContain(n.slug);
  expect(existsSync(join(import.meta.dirname, "../src/lib/ui/news/README.md"))).toBe(true);
});

test("stories come newest first, with readable dates", () => {
  expect(dayOf("2026-11-18")).toBe("18 Nov 2026");
  const dates = news().items.map((n) => Date.parse(n.date));
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
});

test("Home shows the header, the topics and every story", () => {
  const data = { news: news() };
  const { body } = render(Home as never, { props: { data } as never });
  expect(body).toContain("What's Going On in Arc");
  expect(body).toContain("Filter");
  for (const n of data.news.items) expect(body).toContain(n.headline);
});
