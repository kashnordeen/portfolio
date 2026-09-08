# Keshav Kumar Karn — Personal Portfolio

A modern, high-performance personal portfolio built with React, TypeScript, Vite, Tailwind CSS, and Framer Motion.

## 🚀 Features

- **Hanging ID Card**: Realistic pendulum physics simulation ($g=3000$, damping $=0.92$) with drag, velocity flick, and click impulse interactions.
- **Floating Glass Header**: Dynamic scroll detection (hides downwards, reveals upwards) with circular clip-path spring transition on mobile.
- **Projects Bento Grid**: 12-column asymmetric layout with GPU-accelerated hover zoom and animated action triggers.
- **Development Journey**: Scroll-linked timeline with real-time active node glow and progress bead.
- **Floating macOS Dock**: Magnification physics on hover with item tooltip badges and show/hide scroll threshold.
- **Light / Dark Mode**: Spatial View Transition API integration with Aurora gradient typography in dark mode.
- **Continuous Tech Marquee**: 35-second seamless loop with edge vignette masks and pause-on-hover.
- **Centralized Data Architecture**: All content cleanly managed in `src/data/portfolio.ts`.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Smooth Scroll**: [Lenis](https://github.com/darkroomengineering/lenis)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Typography**: [Geist Sans](https://vercel.com/font)

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kashnordeen/portfolio.git
   cd portfolio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:8080`.

### Production Build

```bash
npm run build
npm run preview
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
