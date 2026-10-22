---
title: "feat: lowercase marketing website"
type: feat
status: active
date: 2026-10-22
product_contract_source: ce-plan-bootstrap
---

# feat: lowercase marketing website

## Product Contract

### Summary

A fast, static marketing site (Home, Methodology, Pricing, Blog plus post pages) that explains how lowercase teaches case thinking instead of handing over a casebank. It follows the light, card-based layout of the reference screenshot, uses lowercase's own brand and words, and sends every sign-up and log-in to `https://app.trylowercase.app/login`.

### Problem Frame

lowercase has a working app (adaptive concept lessons, live peer cases with an issue tree and rubric, XP and leagues) but no public page. B-school students and people moving into consulting who hear about it can't tell how it differs from the many casebooks and case libraries they already have. The difference is the method: concepts are mastered before cases, difficulty unlocks only with demonstrated skill, review is spaced and mixed, and practice is active (friends or an AI interviewer who gives facts only when earned). The site has to make that method concrete and credible enough to earn a sign-up without hype. It also has to frame pricing for a program that is meant to end: nobody should need it beyond six months.

### Requirements

- R1. Pages: Home, Methodology, Pricing, Blog index, and blog post pages, with a shared header and footer and CTAs on every page.
- R2. Layout and visual rhythm follow the reference screenshot: a light, soft-grey page, a centred hero with pill tabs and two buttons, a large hero card with an illustration and a feature list, a "how it works" demo with tabs, a levels section with tabs, three research cards, a dark CTA band, a multi-column footer, and a giant wordmark at the foot. Brand, illustrations and copy are lowercase's own; nothing is taken from the reference product.
- R3. Content covers: learn concepts then apply them to cases; case types (profitability, growth, revenue, market entry, pricing, M&A); difficulty levels that unlock with mastery; gamification; cases drawn from real interviews; the two tracks (practice with friends, with role switch and rubric; practice with AI, which asks questions, releases facts only as earned, and unlocks the issue tree as you go).
- R4. The Methodology page is grounded in the Math Academy pedagogy principles (mastery learning, the 2-sigma problem, automaticity, active learning and deliberate practice, spaced repetition, interleaving, layering, non-interference, minimising cognitive load, worked examples) and translated to case prep, with further reading.
- R5. Pricing: 4-week Sprint ₹3,499 (practice with friends only), 3-month Marathon ₹3,999 (+ AI chat tutor), 6-month Journey ₹4,999 (+ AI chat and voice interviewer). One-time passes with no auto-renewal, framed around finishing within six months.
- R6. Log-in and every sign-up CTA link to `https://app.trylowercase.app/login`.
- R7. Copy is natural and persuasive without pressure: lead with the reader's problem, show the mechanism, reduce risk, one clear primary action per section.
- R8. Small, restrained animations that respect `prefers-reduced-motion`.
- R9. Performance on par with the best benchmarks: static HTML, almost no JavaScript, Lighthouse 95+ on every page, good Core Web Vitals, responsive down to 360 px, accessible (WCAG AA contrast, keyboard, semantic landmarks).

### Success Criteria

- A first-time visitor can say, after the Home page, what lowercase does differently and which track they would use.
- Every page builds to static files with no runtime dependency and loads with under ~15 KB of JavaScript.
- No invented testimonials, user counts, ratings or outcome statistics.

### Scope Boundaries

- No checkout or payment integration; pricing CTAs go to log-in.
- No changes to the app under `src/`.
- AI chat tutor and voice interviewer are not built here. The site labels them "early access" until they ship.
- No CMS: blog posts are files in the repo.
- Deploying the site (DNS for `trylowercase.app`, CDN account) is left to the owner; the plan documents it.

## Planning Contract

### Key Technical Decisions

- KTD1. **Separate static site in `site/`, not routes in the Next app.** The app's `/` is the signed-in home, it runs as one Node container on one VM, and it pins its Host allowlist to its own address. The app moves to `app.trylowercase.app` so the website can have the main domain. A static site on a CDN is faster, can't take the app down, and deploys independently. Intended address: `trylowercase.app` (any static host: Cloudflare Pages, Netlify, Vercel).
- KTD2. **Zero-dependency Node build script** (`site/build.mjs`) that wraps page bodies in a shared layout and writes `site/dist/`. No framework, no `npm install`, so nothing changes in the pinned dependency set or `allowScripts`. Blog posts are HTML fragments with a small JSON front block, so there's no Markdown parser to add.
- KTD3. **One hand-written CSS file with design tokens** on `:root`. Light theme to match the reference; the app's emerald (`#22c55e`) and royal blue carry the brand across. Plus Jakarta Sans (the app's font) from Google Fonts with `display=swap` and preconnect; the system stack is the fallback.
- KTD4. **One small vanilla JS file** (deferred) for tab switching, scroll-reveal with `IntersectionObserver`, the demo animation loop and the mobile menu. Every page works without it: tabs fall back to showing the first panel, and reveals are visible by default unless JS adds the `js` class.
- KTD5. **Illustrations are inline SVG and HTML/CSS mock-ups** (issue tree, session screen, fact cards), not raster images. This gives zero image requests, sharp rendering, and no third-party assets.
- KTD6. **Honest labelling of unbuilt features.** AI tutor features carry an "Early access" badge. Testimonial slots from the reference become an FAQ and a "what you'll be able to do" section.

### Implementation Units

- U1. **Scaffold and build.** `site/build.mjs`, `site/src/layout.html`, `site/src/partials/`, `site/public/` (CSS, JS, favicon, robots, sitemap generation), `site/README.md` (build, preview, deploy). Repo hygiene: `.gitignore` gets `site/dist/`, `.dockerignore` gets `site`, and ESLint ignores `site/**`. Verify: `node site/build.mjs` writes every page, and links resolve.
- U2. **Design system.** `site/public/styles.css`: tokens, type scale, buttons, pills, cards, sections, header/footer, reveal animation, reduced-motion handling, responsive grid.
- U3. **Home page.** `site/src/pages/index.html`: hero with track pills and CTAs; hero card (issue-tree SVG and feature list); "Watch a case unfold" demo with Friend/AI tabs; levels section (Level 1–3 tabs with topics and case types); "Built on how people learn" research cards; two-tracks section; FAQ; dark CTA band.
- U4. **Methodology page.** `site/src/pages/methodology.html`: the principles above, each with what it means for case prep and how lowercase applies it, plus further reading.
- U5. **Pricing page.** `site/src/pages/pricing.html`: three plan cards (Journey highlighted as the complete plan), a comparison table, "why passes end" note, pricing FAQ.
- U6. **Blog.** `site/src/blog/*.html` (three starter posts) with the index and post template generated by the build; reading time and dates.
- U7. **Verification.** Serve `site/dist` locally, check every page at desktop and 375 px, check console errors, keyboard navigation, reduced motion, and the JS payload size.

### Test Scenarios

- Build: every page and post appears in `dist/`, the sitemap lists them, and the build fails loudly on a missing partial.
- Every `Log in` and primary CTA `href` equals `https://app.trylowercase.app/login`.
- With JS disabled, all content is visible and the first tab panel shows.
- With reduced motion, no reveal or demo animation runs.
- At 375 px, there is no horizontal scroll, the nav collapses to a menu, and pricing cards stack.
