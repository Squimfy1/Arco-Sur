/**
 * Arco-Sur as a desktop app.
 *
 * The SvelteKit server runs INSIDE this process: no port is opened, not even
 * on localhost. The window asks for arco://app/..., and the handler below
 * answers each request by calling SvelteKit directly, the way a web server
 * would, but without any network in between.
 *
 * Two halves, kept apart:
 *   main process (this file + build/server)  reads the key, the log, the chain
 *   window (build/client)                    shows pages; no Node, no key,
 *                                            sandboxed, can't open other sites
 */

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import { app, BrowserWindow, protocol, shell } from "electron";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, "..", "build");
const CLIENT = join(BUILD, "client");
const ORIGIN = "arco://app";
// What SvelteKit sees. A custom scheme has no real "origin" in Node's URL
// rules, so requests are handed over as an ordinary https address instead.
const INNER = "https://arco-sur.app";

// Where the key and the evidence log live. Running from the repo, that is
// the repo. Packaged, the build records the repo's path in package.json.
const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));
process.env.ARCO_SUR_ROOT ??= pkg.arcoSurRoot ?? join(HERE, "..");

protocol.registerSchemesAsPrivileged([
  { scheme: "arco", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const TYPES = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** A file under build/client, or null. Never anything outside it. */
function staticFile(pathname) {
  const file = normalize(join(CLIENT, decodeURIComponent(pathname)));
  if (!file.startsWith(CLIENT + sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  const headers = { "content-type": TYPES[extname(file)] ?? "application/octet-stream" };
  if (pathname.startsWith("/_app/immutable/")) headers["cache-control"] = "public, max-age=31536000, immutable";
  return new Response(Readable.toWeb(createReadStream(file)), { headers });
}

/** Rewrite one URL between the window's address and SvelteKit's. */
const swap = (url, from, to) => (url.startsWith(from) ? to + url.slice(from.length) : url);

async function start() {
  if (!existsSync(join(BUILD, "server", "server.js"))) {
    throw new Error("No build found. Run: npm run build");
  }
  const { server } = await import(pathToFileURL(join(BUILD, "server", "server.js")).href);
  await server.init({
    env: process.env,
    read: (file) => Readable.toWeb(createReadStream(join(CLIENT, file))),
  });

  protocol.handle("arco", async (request) => {
    const url = new URL(request.url);
    if (url.host !== "app") return new Response("Not found", { status: 404 });

    const file = staticFile(url.pathname);
    if (file) return file;

    // SvelteKit refuses a form POST unless its Origin is the site's own, to
    // stop other websites submitting forms. Chromium sends no usable Origin
    // for a custom scheme. Only this app's window can reach arco:// at all
    // (no other site is ever loaded in it), so every request here IS from
    // the app, and it says so.
    const headers = new Headers(request.headers);
    headers.set("origin", INNER);
    const inner = new Request(swap(request.url, ORIGIN, INNER), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    });
    const response = await server.respond(inner, { getClientAddress: () => "127.0.0.1" });

    // A redirect to SvelteKit's address goes back to the window's.
    const location = response.headers.get("location");
    if (location) {
      const out = new Headers(response.headers);
      out.set("location", swap(location, INNER, ORIGIN));
      return new Response(response.body, { status: response.status, headers: out });
    }
    return response;
  });
}

function openWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    title: "Arco-Sur",
    backgroundColor: "#141317",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Links to the web (explorer, faucet) open in the normal browser; the
  // app window itself only ever shows the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) {
      event.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });
  // No camera, microphone, notifications or anything else.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, done) =>
    done(permission === "clipboard-sanitized-write"),
  );

  win.loadURL(`${ORIGIN}/`);
}

app.whenReady().then(async () => {
  await start();
  openWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
