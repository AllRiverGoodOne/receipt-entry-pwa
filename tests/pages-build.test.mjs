import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "pages-dist");

await import("../scripts/build-pages.mjs");

test("GitHub Pages公開物はPWAファイルだけを含む", async () => {
  const required = [
    "index.html",
    "styles.css",
    "app.js",
    "receipt-core.js",
    "recommendations.js",
    "manifest.webmanifest",
    "sw.js",
    "icons/icon-192.png",
    "icons/icon-512.png",
    ".nojekyll"
  ];
  await Promise.all(required.map((file) => access(path.join(outputRoot, file))));

  const blocked = [
    "pwa-apps.json",
    "領収書PWA_詳細仕様書.md",
    "scripts/serve_intranet.py",
    ".certs/server-key.pem"
  ];
  for (const file of blocked) {
    await assert.rejects(access(path.join(outputRoot, file)));
  }
});

test("公開PWAは相対URLとオフライン制御を使用する", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(outputRoot, "manifest.webmanifest"), "utf8")
  );
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");

  const serviceWorker = await readFile(path.join(outputRoot, "sw.js"), "utf8");
  assert.match(serviceWorker, /caches\.match\("\.\/index\.html"\)/);

  const app = await readFile(path.join(outputRoot, "app.js"), "utf8");
  assert.match(app, /navigator\.serviceWorker\.controller/);
  assert.match(app, /history\.replaceState\(null, "", window\.location\.pathname\)/);
});

test("公開PWAはコンビニと宿泊に特化した入力画面を含む", async () => {
  const html = await readFile(path.join(outputRoot, "index.html"), "utf8");
  assert.match(html, /data-entry-mode="convenience"/);
  assert.match(html, /data-entry-mode="lodging"/);
  assert.match(html, /id="memo"/);
  assert.match(html, />明細内容 /);

  const app = await readFile(path.join(outputRoot, "app.js"), "utf8");
  assert.match(app, /counterparty: "コンビニ"/);
  assert.match(app, /counterparty: "宿泊"/);
});
