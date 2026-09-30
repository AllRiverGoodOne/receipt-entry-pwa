import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "pages-dist");
const registry = JSON.parse(
  await readFile(path.join(projectRoot, "pwa-apps.json"), "utf8")
);
const app = registry.apps.find(({ id }) => id === "receipt");

if (!app) throw new Error("pwa-apps.jsonにreceiptアプリが登録されていません。");

const sourceRoot = path.resolve(projectRoot, app.source);
if (sourceRoot !== projectRoot && !sourceRoot.startsWith(`${projectRoot}${path.sep}`)) {
  throw new Error("公開元がプロジェクト外を指しています。");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const relativeFile of app.files) {
  const source = path.resolve(sourceRoot, relativeFile);
  const destination = path.resolve(outputRoot, relativeFile);
  if (!source.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`公開対象に不正なパスがあります: ${relativeFile}`);
  }
  if (!destination.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error(`出力先に不正なパスがあります: ${relativeFile}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

await writeFile(path.join(outputRoot, ".nojekyll"), "", "utf8");
console.log(`GitHub Pages公開物を作成しました: ${outputRoot}`);
