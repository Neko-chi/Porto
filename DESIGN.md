---
name: Renaissance Ricarda
description: Dark construction-drawing world where a swarm of agent cursors builds the page.
colors:
  ground: "#0c0f12"
  ground-raised: "#13171b"
  line: "#262c33"
  line-strong: "#3a424b"
  ink: "#f3f5f6"
  ink-muted: "#aab3bb"
  ink-faint: "#87919a"
  selection-blue: "#2e8bff"
  ruler-vermilion: "#ff4a2e"
  ornament-gold: "#f5b83d"
typography:
  display:
    fontFamily: Archivo
    fontSize: clamp(2.5rem, 5.4vw, 5rem)
    fontWeight: 620
    lineHeight: 1.04
    letterSpacing: -0.032em
  headline:
    fontFamily: Archivo
    fontSize: clamp(2.1rem, 4.4vw, 4rem)
    fontWeight: 620
    lineHeight: 1.04
    letterSpacing: -0.032em
  body:
    fontFamily: Archivo
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.6
  data:
    fontFamily: Martian Mono
    fontSize: 0.75rem
    fontWeight: 400
rounded:
  none: 0px
spacing:
  gutter: clamp(16px, 4vw, 48px)
  section: clamp(96px, 12vw, 176px)
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    padding: 0 26px
    height: 52px
---

# Design System: Renaissance Ricarda

## Overview

The page behaves like a construction drawing being worked on. It opens on a single RR tile. Hovering releases cursors, clicking enters. A few coloured cursors then wait in fixed seats around the visitor's own pointer, and leave to frame and fill each layer. Layers that have been scrolled past shrink away on their own and rebuild on the way back. The hero object is a single monitor. Its screen boots through a Parrot-style menu and kernel log, reaches a login, signs in, and opens a terminal. The palette comes from the owner's photograph: black coat, red knit, gold ornament, cyan sky.

## Colors

Restrained ground with colour that does a job. Selection blue marks anything being worked on, and the current nav item. Vermilion is the ruler guide. Gold is ornament: the rank numeral and organisation names. Agent cursors are the only place the full spectrum appears.

## Typography

One family, Archivo, used at two widths: 112% for headings and 100% for reading. Headings are two-tone, a statement in ink followed by a quieter second line in faint ink. Martian Mono is reserved for data: dates, tags, HUD readouts, and measurements. It is never used for prose.

## Layout

A wrap of 1376px with fluid gutters. Sections alternate density: a large case study, a ruled skill list, a sticky-heading timeline, a table. Lists are separated by hairlines rather than boxed in cards. The hero's facts band is an opaque horizon, and the 3D object rises from behind it.

## Elevation & Depth

Flat. Depth comes only from the WebGL object. No shadows or glass on interface surfaces.

## Shapes

Square corners everywhere. Square selection handles are the recurring shape.

## Components

- **Selection frame:** blue 1px outline with square corner handles. Appears during the build, on skill rows at hover, and permanently around the rank numeral.
- **Button:** ink fill, ground text, blue offset ring on hover.
- **Arrow link:** underlined text with a drawn icon, turns selection blue on hover.
- **RR tile:** the only thing on the entry screen. It flies to the nav logo on entry and back on exit.
- **Agent:** two crews. Scalers (six, three on phones) drag the blue size frame for each layer. Typists (ten, five on phones) then type or fill inside that frame and wear the theme's colour. Free cursors hold two tidy rings around the pointer and surround whatever the visitor is about to press.
- **Build jobs:** `data-b` values `text`, `box`, `line`, and `pop` inside a `data-unit`.

## Do's and Don'ts

- Do keep all content in the HTML. The engine only delays it.
- Do keep idle cursors still in their seats, never orbiting or wandering.
- Do keep building slow enough to watch, and never hide idle cursors.
- Do skip the build entirely for reduced motion and data saver.
- Don't put a label or eyebrow above a heading.
- Don't use monospace for prose.
- Don't box lists into same-size cards.
