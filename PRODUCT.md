# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: recruiters and hiring engineers who open the link from a CV, LinkedIn, or a message, usually on a laptop, sometimes on an Android phone. They have a minute or two to decide whether to talk to this candidate. Secondary visitors (project collaborators, competition judges) use the same page.

## Product Purpose

Personal portfolio of Renaissance Ricarda Sugiarto Putra. Success means a recruiter understands who this is and what they can do within seconds, finds proof, then downloads the CV or makes contact.

## Positioning

One person who works both sides: builds full-stack and AI systems, then attacks them as a security tester. The site uses no framework or library, and the build animation runs on its own engine.

## Operating Context

Static site on GitHub Pages at renaissancericarda.my.id (CNAME in repo). No build step. The owner edits the files directly.

## Capabilities and Constraints

- Plain HTML, CSS, and JavaScript only.
- Bilingual: Indonesian and English with a visible switch.
- Contact form posts to Web3Forms when an access key is set, and falls back to mailto while the key is the placeholder.
- All content stays in the HTML so it works for search engines and without JavaScript.

## Brand Commitments

- Name: Renaissance Ricarda Sugiarto Putra, short form RR.
- The user pinned the visual reference: a dark engineering-studio theme with a swarm of agent cursors building the page. The reference site's logo, copy, and 3D object must not be copied.

## Evidence on Hand

- `CV.pdf`, `assets/photo.jpeg`.
- Juara 1 Web Technologies Competition, Kabupaten Indramayu, 2026, with certificate on Google Drive.
- A.R.O.N.A, with public GitHub repository.
- Seven credentials with links, plus a Google Drive archive.
- No project screenshots, testimonials, or employment history exist. Do not fabricate them.

## Product Principles

1. Who, what, and proof stay easy to reach. The owner chose an RR entry screen, so entering must take one click, and reduced-motion visitors skip it.
2. Every claim links to evidence where evidence exists.
3. The site must demonstrate the craft it claims.
4. It must stay fast on a mid-range Android phone.

## Accessibility & Inclusion

Respect `prefers-reduced-motion` and data saver by skipping the build animation entirely. Keyboard users must never be blocked by unbuilt content. Text contrast meets WCAG AA.
