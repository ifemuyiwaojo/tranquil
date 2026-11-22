import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagesDir = join(root, "src", "pages");
const counties = ["Fulton", "DeKalb", "Gwinnett", "Cobb", "Clayton", "Coweta", "Douglas", "Fayette", "Henry", "Polk", "Paulding", "Cherokee", "Bartow", "Floyd", "Carroll", "Butts", "Pike", "Chattooga", "Gordon"];
const countyHtml = `<ul class="counties">${counties.map((name) => `<li>${name}</li>`).join("")}</ul>`;

function navLink(active, id, href, label) {
  const current = active === id ? ' class="is-current" aria-current="page"' : "";
  return `<a${current} href="${href}">${label}</a>`;
}

function header(active) {
  return `<a class="skip" href="#main">Skip to content</a>
<div class="topbar"><div class="wrap topbar-inner"><span>Licensed private home care · Kennesaw, Georgia</span><a href="tel:6782900070">(678) 290-0070</a><a href="tel:6784586610">(678) 458-6610</a></div></div>
<header class="site-header"><div class="wrap header-row">
<a class="brand" href="/"><img src="/assets/logo.svg" alt="" width="46" height="46"><span><strong>Tranquil Inc.</strong></span></a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
<nav id="site-nav" class="site-nav" aria-label="Primary">
${navLink(active, "about", "/about.html", "About")}
${navLink(active, "services", "/services.html", "Services")}
${navLink(active, "programs", "/programs.html", "Programs")}
${navLink(active, "areas", "/areas.html", "Areas")}
${navLink(active, "forms", "/forms.html", "Forms")}
${navLink(active, "careers", "/careers.html", "Careers")}
<a class="btn btn-sm" href="/referral.html">Request care</a>
</nav></div></header>
<noscript><div class="wrap"><p class="notice">Secure forms on this site encrypt your answers in the browser. Please turn JavaScript on, or call (678) 290-0070.</p></div></noscript>`;
}

function footer() {
  return `<footer class="site-footer"><div class="wrap footer-grid">
<div><img src="/assets/logo.svg" alt="" width="46" height="46"><h2>Tranquil, Inc.</h2><p>The private home care providers. Peace, love, and care in harmony.</p><p>P.O. Box 2754<br>Kennesaw, GA 30156</p></div>
<div><h2>Explore</h2><ul>
<li><a href="/about.html">About</a></li>
<li><a href="/services.html">Services</a></li>
<li><a href="/programs.html">Programs</a></li>
<li><a href="/areas.html">Service area</a></li>
<li><a href="/careers.html">Careers</a></li>
<li><a href="/contact.html">Contact</a></li>
</ul></div>
<div><h2>Forms</h2><ul>
<li><a href="/referral.html">Request care</a></li>
<li><a href="/apply.html">Employment application</a></li>
<li><a href="/forms.html">All forms</a></li>
<li><a href="/grievance.html">Share a concern</a></li>
<li><a href="/read.html">Open a secure submission</a></li>
</ul></div>
<div><h2>Contact</h2><ul class="contact-list">
<li><a href="tel:6782900070">(678) 290-0070</a></li>
<li><a href="tel:6784586610">(678) 458-6610</a></li>
<li>Fax (678) 290-0235</li>
<li><a href="mailto:tranquil2754@hotmail.com">tranquil2754@hotmail.com</a></li>
</ul></div>
</div>
<div class="wrap legal-line">
<p class="lang-note">Si habla español, llame al <a href="tel:6782900070">(678) 290-0070</a> y pida ayuda en su idioma. Language help is free.</p>
<p>Tranquil, Inc. does not discriminate in services or employment. NPI 1316529639. Licensed private home care provider. If this is an emergency, call 911. This website is not monitored as an emergency line.</p>
<p><a href="/privacy.html">Privacy</a> · <a href="/rights.html">Client rights</a> · <a href="/accessibility.html">Accessibility</a> · <a href="/grievance.html">Concerns</a></p>
<p>© <span data-year>2026</span> Tranquil, Inc.</p>
</div></footer>`;
}

const files = readdirSync(pagesDir).filter((name) => name.endsWith(".html"));
for (const file of files) {
  const source = readFileSync(join(pagesDir, file), "utf8");
  const comment = source.match(/^<!--([\s\S]*?)-->/);
  if (!comment) throw new Error(file + " is missing its page header comment.");
  const meta = {};
  for (const line of comment[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  const body = source.slice(comment[0].length).trim().replaceAll("{{COUNTIES}}", countyHtml);
  const assetVersion = "3";
  const scripts = (meta.scripts || "").split(/\s+/).filter(Boolean).concat("js/site.js").map((src) => `<script src="/${src}?v=${assetVersion}"></script>`).join("");
  const robots = meta.robots ? `<meta name="robots" content="${meta.robots}">` : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0c2340">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
${robots}
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/styles.css?v=3">
</head>
<body>
${header(meta.active || "")}
<main id="main">${body}</main>
${footer()}
${scripts}
</body>
</html>
`;
  writeFileSync(join(root, "public", file), html);
  console.log("built", file);
}

writeFileSync(join(root, "public", "robots.txt"), `User-agent: *
Allow: /
Disallow: /read.html
Disallow: /assessment.html
Disallow: /supervisory.html
Disallow: /api/
`);
console.log("built robots.txt");
