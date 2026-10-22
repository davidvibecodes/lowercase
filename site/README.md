# lowercase marketing site

The public website (Home, Methodology, Pricing, Blog). It is a static site, separate from the app: the website is `https://trylowercase.app`, the app lives at `https://app.trylowercase.app`, and every "Log in" and "Get started" button here points at `https://app.trylowercase.app/login`. The plan is `docs/plans/2026-10-22-1200-feat-marketing-website-plan.md`.

No dependencies and no `npm install`: a small Node script wraps each page in the shared layout.

```bash
npm run site:build     # writes site/dist
npm run site:preview   # serves site/dist on http://localhost:4321
```

## Layout

| Path | What it is |
|---|---|
| `src/layout.html` | The `<html>` shell: meta tags, fonts, CSS, JS |
| `src/partials/*.html` | Header, footer, CTA band, logo, blog templates. Include with `{{> name}}` |
| `src/pages/*.html` | One file per page. `index.html` → `/`, `pricing.html` → `/pricing/` |
| `src/blog/*.html` | One file per post. The filename is the URL slug: `/blog/<slug>/` |
| `public/` | Copied as-is: `styles.css`, `site.js`, `favicon.svg` |

Every page and post starts with a JSON front block:

```html
<!--{ "title": "…", "description": "…", "date": "2026-10-20", "tag": "Method" }-->
```

Posts need `date` (YYYY-MM-DD) and `tag`. Tokens available in every file: `{{LOGIN}}`, `{{SITE}}`, `{{YEAR}}`. An unknown token or partial fails the build.

## Adding a blog post

Copy one of the files in `src/blog/`, change the front block, and write the body in plain HTML (`<p>`, `<h2>`, `<h3>`, `<ul>`, `<blockquote>`, `<pre><code>`, `<div class="callout">`). Run the build. The blog index, reading time and sitemap update automatically.

## Deploying

Any static host works (Cloudflare Pages, Netlify, Vercel):
- build command `node site/build.mjs`
- output directory `site/dist`

Point `trylowercase.app` at the host. If you use another domain, change `SITE_URL` in `build.mjs` so canonical URLs and the sitemap match.

## Rules for copy

- Don't invent testimonials, user counts, ratings or outcome numbers. Add real ones when you have them.
- The AI interviewer carries an "Early access" badge until it ships in the app. Remove the badges (search for `Early access`) when it does.
