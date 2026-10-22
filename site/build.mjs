// Builds the static marketing site into site/dist. No dependencies: page
// bodies in src/pages and posts in src/blog are wrapped in src/layout.html.
// Each source file opens with a JSON front block: <!--{ "title": "…" }-->
import { readFile, writeFile, mkdir, readdir, rm, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

export const SITE_URL = "https://trylowercase.app";
export const LOGIN_URL = "https://app.trylowercase.app/login";

const WPM = 220;

function parse(file, raw) {
  const m = raw.match(/^\s*<!--(\{[\s\S]*?\})-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--{ … }--> front block`);
  return { meta: JSON.parse(m[1]), body: raw.slice(m[0].length) };
}

async function partials() {
  const dir = join(SRC, "partials");
  const out = {};
  for (const f of await readdir(dir)) out[f.replace(/\.html$/, "")] = await readFile(join(dir, f), "utf8");
  return out;
}

function fill(html, vars, parts) {
  // Partials first (they may use vars), then vars. Unknown tokens fail the build.
  // Partials may include partials, so expand until none remain.
  let s = html;
  for (let depth = 0; /\{\{>/.test(s); depth++) {
    if (depth > 5) throw new Error("partials nested too deeply");
    s = s.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => {
      if (!(n in parts)) throw new Error(`unknown partial: ${n}`);
      return parts[n];
    });
  }
  s = s.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, n) => {
    if (!(n in vars)) throw new Error(`unknown token: {{${n}}}`);
    return vars[n];
  });
  return s;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function readingTime(html) {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WPM));
}

async function write(path, html) {
  const file = join(DIST, path, "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(join(ROOT, "public"), DIST, { recursive: true });

  const layout = await readFile(join(SRC, "layout.html"), "utf8");
  const parts = await partials();
  const year = String(new Date().getFullYear());
  const base = { LOGIN: LOGIN_URL, SITE: SITE_URL, YEAR: year };
  const urls = [];

  const render = (meta, body, path) => {
    const vars = {
      ...base,
      TITLE: esc(meta.title),
      DESCRIPTION: esc(meta.description),
      CANONICAL: SITE_URL + path,
      OG_TYPE: meta.ogType ?? "website",
      NAV_METHOD: path.startsWith("/methodology") ? ' aria-current="page"' : "",
      NAV_PRICING: path.startsWith("/pricing") ? ' aria-current="page"' : "",
      NAV_BLOG: path.startsWith("/blog") ? ' aria-current="page"' : "",
      BODY_CLASS: meta.bodyClass ?? "",
      ...(meta.vars ?? {}),
    };
    const inner = fill(body, vars, parts);
    urls.push(path);
    return fill(layout, { ...vars, CONTENT: inner }, parts);
  };

  // Pages
  for (const f of await readdir(join(SRC, "pages"))) {
    const { meta, body } = parse(f, await readFile(join(SRC, "pages", f), "utf8"));
    const path = f === "index.html" ? "/" : `/${f.replace(/\.html$/, "")}/`;
    await write(path, render(meta, body, path));
  }

  // Blog posts, newest first
  const posts = [];
  for (const f of await readdir(join(SRC, "blog"))) {
    const { meta, body } = parse(f, await readFile(join(SRC, "blog", f), "utf8"));
    posts.push({ ...meta, slug: f.replace(/\.html$/, ""), body, minutes: readingTime(body) });
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));

  const postTpl = parts["post"];
  for (const p of posts) {
    const path = `/blog/${p.slug}/`;
    const body = fill(postTpl, {
      ...base,
      POST_TITLE: esc(p.title),
      POST_DATE: fmtDate(p.date),
      POST_ISO: p.date,
      POST_MINUTES: String(p.minutes),
      POST_TAG: esc(p.tag),
      POST_BODY: p.body,
    }, parts);
    await write(path, render({ ...p, ogType: "article" }, body, path));
  }

  const cards = posts.map((p) => `
      <a class="card post-card reveal" href="/blog/${p.slug}/">
        <span class="tag">${esc(p.tag)}</span>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.description)}</p>
        <span class="meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> · ${p.minutes} min read</span>
      </a>`).join("");
  const blogIndex = fill(parts["blog-index"], { ...base, POST_CARDS: cards }, parts);
  await write("/blog/", render({
    title: "Blog · lowercase",
    description: "Notes on case interviews, structured thinking, and how skills are actually learned.",
  }, blogIndex, "/blog/"));

  // sitemap + robots
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  await writeFile(join(DIST, "sitemap.xml"), sitemap);
  await writeFile(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log(`built ${urls.length} pages into site/dist`);
}

build().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
