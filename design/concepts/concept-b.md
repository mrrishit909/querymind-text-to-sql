# Concept B: CANOPY

## Visual thesis

Every query is a tree, and the site is a forest of real ones.

CANOPY is the highest-abstraction concept. It drops the corridor, the panels and almost all prose. The whole viewport is a dark field of **real sqlglot syntax trees**, each grown as a radial structure from its root `Select` node:

- 10 tall trees for Claude's SQL;
- 6 for the security demos;
- about 40 for the attack corpus.

**What the forms encode:**

- **Node class sets the glyph.**
  - `Table` is a lime square. `Column` is a silver dot.
  - Allowlisted `Func` nodes are cobalt rings. `Anonymous` functions are hollow slate rings.
  - `CTE` nodes are cobalt arcs that enclose their bodies.
- **Branch length is depth.**
- **Accepted trees bear fruit.** Executed rows hang from the root as lime beads, one per row, and capped trees show `50 of 189`.
- **Rejected trees are pruned.** The branch holding the offending node is severed and drifts 12 px down, still attached by a hairline to the node the validator named.

**The visitor types SQL into a single line at the bottom of the screen.** A new sapling grows live in the clearing at the center:

- The real AST comes from Pyodide-sqlglot.
- The validator is the real file.
- Each keystroke regrows the tree.

**The breach** is one tree in two seasons:

- The `pg_roles` attack tree is shown under the reconstructed pre-fix validator: whole, bearing 18 fruit, one of them breach-red (`postgres · rolsuper true`).
- Toggle to the current validator: the `Table(db=pg_catalog)` branch is cut, and the fruit falls.

## Palette

- **Base colors:** obsidian field, silver for leaves and labels, cobalt for structure (Func/CTE arcs), lime for data fruit and Table nodes, slate for pruned and dead wood.
- **Extension:** breach `#FF5C4D` is used for the leaked fruit only.
- **Density comes from glyph count, not color count.** The field holds up to about 2,000 nodes on screen.

## Typography

- Almost none: there is no body-copy column.
- **Martian Mono `wdth 75`, 11 px**, labels nodes on hover only.
- **Instrument Sans 600**, at 96–160 px and about 60% transparent over the canopy, carries the single claims that appear per scroll beat, for example "Ten questions. Ten trees. All legal."
- **Newsreader italic** is reserved for the question that seeds each tree. It floats at the tree's base like a caption on a specimen.

## Layout strategy

- **The field is full-bleed.** Camera moves (pan/zoom) are driven by scroll.
- **Beats:**
  - Grove (12 questions, arranged by category in 6 clearings)
  - Specimen (zoom into one tree, with SQL and table in a translucent card)
  - Nursery (builder: chips graft branches onto a living tree)
  - Clearing (the attack console)
  - Two Seasons (the breach)
- The **Inspector is a "specimen card"** that slides in from the right. It holds the question, the raw and regenerated SQL, views, rows, the chart and the assumptions.
- **Information density is very high in the image, and very low in text.**

## Opening storyboard (~10 s)

1. **0–1.5 s.** The Q1 question appears in Newsreader 48 px at the bottom center.
2. **1.5–3 s.** Phrases glow, and each phrase drops a seed (a dot) toward the ground line.
3. **3–4.5 s.** The seeds separate laterally into 5 groups, and each one sprouts a clause stem (`SELECT`, `FROM`, `WHERE`, `GROUP BY`, `ORDER BY · LIMIT`).
4. **4.5–6.5 s.** The stems branch into the full real AST, grown breadth-first in `stmt.walk()` order. It reads like a time-lapse of a tree.
5. **6.5–8 s.** The root swells, and 3 lime beads (the 3 real rows) descend from it as a hanging table.
6. **8–9.2 s.** The beads stretch into 3 vertical bars, which become the tree's "roots" below ground.
7. **9.2–10 s.** The camera pulls back to reveal the whole grove of 12 trees. Q1's tree is lit, and the specimen card opens.

**Reduced motion:** the grown trees appear statically and the camera cuts between beats.

## Motion grammar

- **Growth is organic but deterministic.** Each branch takes 60 ms and follows `stmt.walk()` order. Every tree regrows identically each time.
- **Camera moves are slow and eased**, 900–1400 ms.
- **Pruning is one cut**: an 80 ms snap, then a 600 ms drift.
- **Ambient sway is 0.5 px of seeded sine**, which is the one decorative motion allowed. It stops under reduced motion.

## Primary interaction

- The **sapling console**: type SQL and watch the real tree regrow and get judged.
- **Click any node** in any tree to see its sqlglot class and the gate that inspects it.

## Technical approach

- WebGL instanced quads and lines through regl, or a raw WebGL2 context, for about 2,000 nodes with a camera.
- Tidy radial layout through `d3-hierarchy`.
- Pyodide in a worker, as in A.
- Text labels go in a DOM overlay for accessibility. A parallel `<table>`/list view gives screen readers access to every tree.

## Performance risk

- **WebGL plus camera plus layout** for about 56 trees, alongside Pyodide re-parsing on every keystroke, on the main-thread render budget of mobile GPUs.
- The forest is gorgeous but heavy. Hit-testing small nodes on touch is also poor.
- **Accessibility debt is structural.** The core content lives in a canvas, so a full parallel DOM is mandatory.
