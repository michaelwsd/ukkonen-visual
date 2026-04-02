# Ukkonen's Suffix Tree — Step-by-Step Visualizer

An interactive web-based visualizer for Ukkonen's online suffix tree construction algorithm. Built for students learning the algorithm — step through each phase and extension, watch the tree grow, and see how key variables change in real time.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## Features

- **Step-by-step execution** — walk through every phase and extension of the algorithm
- **Tree visualization** — SVG-based suffix tree rendering with pan (drag) and zoom (scroll), auto-fits to viewport
- **Variable state panel** — live display of active node, active edge, active length, last j, leaf end, and last new internal node, with change highlighting
- **Rule annotations** — color-coded badges showing which rule is applied at each step:
  - Rule 1 — Global leaf extension
  - Rule 2, Case 1 (Alternate) — New leaf creation
  - Rule 2, Case 2 (Regular) — Edge split + internal node
  - Rule 3 — Showstopper (implicit extension)
  - Skip/Count — Walking down the tree
- **Suffix links** — displayed as dashed blue arcs with directional arrowheads, including root's self-link
- **Plain-English explanations** — each step includes a description of what happened and why
- **Autoplay** — play through the algorithm with adjustable speed
- **Custom input** — enter any string up to 20 characters
- **Keyboard shortcuts**:
  - `Arrow Left` / `h` — previous step
  - `Arrow Right` / `l` — next step
  - `Arrow Up` / `k` — previous phase
  - `Arrow Down` / `j` — next phase
  - `Space` — play / pause

## Getting Started

```bash
cd visualizer
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
visualizer/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main page — input, controls, layout
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   ├── TreeVisualization.tsx  # SVG tree rendering with pan/zoom
│   │   ├── VariablePanel.tsx      # Algorithm state display
│   │   ├── StringDisplay.tsx      # Input string with phase/suffix highlighting
│   │   └── StepControls.tsx       # Navigation, playback, rule badges
│   └── lib/
│       └── ukkonen.ts        # Algorithm engine + tree layout computation
├── ukkonen.py                # Original Python implementation
└── ukkonen_debug.py          # Python debug version with verbose output
```

## How It Works

The TypeScript implementation in `src/lib/ukkonen.ts` is a direct port of the Python algorithm in `ukkonen.py`. It is instrumented to capture a snapshot of the full tree state at every step — after each Rule 1 application and after every explicit extension (Rule 2 Case 1, Rule 2 Case 2, Rule 3, and skip/count). Each snapshot records:

- The complete node/edge structure of the tree at that moment
- Active point (node, edge, length)
- Which rule was applied
- Which nodes were created or modified
- Suffix link updates

The visualizer replays these snapshots, rendering the tree as an SVG with automatic layout that adapts spacing based on edge label lengths.
