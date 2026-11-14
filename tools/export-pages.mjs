import { mkdir, readdir, readFile, rm, writeFile } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
const source = join(project, "public");
const target = join(project, "site");
const repo = (process.argv[2] || "tranquil").replace(/^\/+|\/+$/g, "");
const prefix = "/" + repo;

function rewrite(text, file) {
  let next = text
    .replaceAll('href="/', 'href="' + prefix + "/")
    .replaceAll("src=\"/", "src=\"" + prefix + "/")
    .replaceAll("fetch(\"/", "fetch(\"" + prefix + "/");
  if (file === "robots.txt") {
    next = next.replaceAll("Disallow: /", "Disallow: " + prefix + "/");
  }
  if (file.endsWith(".html")) {
    const banner = '<div class="wrap"><p class="notice">This is a preview of the website. Please look through every page and make notes on what needs to change. This copy does not save form submissions.</p></div>';
    next = next.replace("</header>", "</header>\n" + banner);
  }
  return next;
}

function copyTree(from, to) {
  return new Promise((resolve, reject) => {
    readdir(from, { withFileTypes: true }, (error, entries) => {
      if (error) {
        reject(error);
        return;
      }
      mkdir(to, { recursive: true }, (mkdirError) => {
        if (mkdirError) {
          reject(mkdirError);
          return;
        }
        const jobs = entries.map((entry) => {
          const src = join(from, entry.name);
          const dest = join(to, entry.name);
          if (entry.isDirectory()) return copyTree(src, dest);
          return new Promise((done, fail) => {
            readFile(src, (readError, data) => {
              if (readError) {
                fail(readError);
                return;
              }
              const ext = entry.name.slice(entry.name.lastIndexOf("."));
              const textFile = ext === ".html" || ext === ".css" || ext === ".js" || ext === ".txt" || ext === ".svg";
              const body = textFile ? rewrite(data.toString("utf8"), entry.name) : data;
              writeFile(dest, body, (writeError) => writeError ? fail(writeError) : done());
            });
          });
        });
        Promise.all(jobs).then(() => resolve(), reject);
      });
    });
  });
}

await new Promise((resolve, reject) => rm(target, { recursive: true, force: true }, (error) => error ? reject(error) : resolve()));
await copyTree(source, target);
await new Promise((resolve, reject) => writeFile(join(target, ".nojekyll"), "", (error) => error ? reject(error) : resolve()));
console.log("Exported " + relative(project, target).split(sep).join("/") + " for " + prefix);
