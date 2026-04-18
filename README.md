# RE → NFA → DFA → Min-DFA Pipeline Visualizer

An interactive web-based simulator designed to visualize the fundamental algorithms of Automata Theory. This tool converts Regular Expressions into finite state machines through a complete Theory of Computation pipeline, providing real-time animation.

## 🚀 Features

- **Algorithmic Pipeline**: Supports the full conversion chain: `Regular Expression` ⮕ `NFA` ⮕ `DFA` ⮕ `Minimized DFA`.
- **Live String Traversal**: Test strings against the generated machine with interactive playback controls (Play, Step, Pause, Reset).
- **Infinite Zoom & Pan**: Explore complex graphs with D3.js powered interactive canvases.
- **Walkthroughs**: Dedicated "Step-by-Step" modules for each conversion phase:
  - (NFA generation)
  - (NFA to DFA)
  - (Minimized DFA)
- **Transition Tables**: Real-time generation of state transition tables for both DFA and Min-DFA.
- **Modern UI**: A sleek, dark-themed interface built for clarity and focus.

## 🛠️ Tech Stack

- **Structure**: Semantic HTML5
- **Styling**: Vanilla CSS3 (Custom Grid System, Modern Dark Theme)
- **Logic**: Vanilla JavaScript (ES6+)
- **Visualization**: [D3.js v7](https://d3js.org/) for graph rendering and physics-based force simulation.

## 📖 How to Use

1.  **Regex Input**: Enter a regular expression such as `(aa+bb)*` or `(a+b)*abb`.
    - Supports `*` (Kleene Star), `+` (Union/OR), and `()` (Grouping).
    - Concatenation is implicit.
2.  **Run Pipeline**: Click the "Run Pipeline" button to generate the automata graphs and stats.
3.  **Explore**: Use the zoom tools and drag nodes to inspect the machine structure.
4.  **Test**: Enter a string in the **Live Traversal** section at the bottom and click **Play** or **Step** to see the machine process the input in real-time.

## 🏁 Installation

This is a client-side web application — no installation is required.

### 🌐 Option 1: Use the Deployed Website
Access the app directly:
👉 https://regex-to-automata-visualizer.vercel.app/

### 💻 Option 2: Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Sainath-10/regex-to-automata-visualizer.git
   ```
2. Open `index.html` in any web browser

---
*Created for educational purposes in Theory of Computation.*
