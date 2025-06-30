# storybook-manager

> **Effortlessly generate and clean Storybook stories for all React components in your project.**
> Maintain consistent, up-to-date component documentation with zero manual work.

---

## Project Overview

**storybook-manager** is a simple CLI tool that scans your `components/` directory and **automatically generates or removes Storybook stories** for every React component, including nested folders.

**Problem solved:**
Creating `.stories.tsx` files manually is time-consuming and error-prone. storybook-manager automates this process, making Storybook adoption effortless and your component library consistently documented.

**Target audience:**

- React developers building component libraries or design systems
- Frontend teams adopting Storybook
- Open-source projects maintaining reusable components

---

## Architecture & Design Principles

- **Node.js CLI with TypeScript** for safety and maintainability.
- **fast-glob** for efficient recursive directory scanning.
- **ts-morph** for reliable analysis of TypeScript/JSX components.
- **Opinionated defaults:** assumes `./components/` as the root directory, no config needed.
- **Simplicity first:** only two clear commands: generate and clean.

---

## Installation & Setup

### 1. Install globally

```bash
npm install -g storybook-manager
```

### 2. Or install locally as a dev dependency

```bash
npm install --save-dev storybook-manager
```

### 3. Add npm scripts to your project’s `package.json`

```json
"scripts": {
  "story:generate": "storybook-manager generate",
  "story:clean": "storybook-manager clean"
}
```

### 4. Place your React components under a `components/` folder in your project root.

### 5. Import your global CSS in Storybook's `preview.ts`

Add the following line to your `.storybook/preview.ts` file to ensure your global styles are applied in Storybook:

```diff
// .storybook/preview.ts
import type { Preview } from "@storybook/nextjs-vite";
+ import "@/app/globals.css";
(other code)
```

---

## Usage

storybook-manager provides two intuitive commands:

### Generate stories

Scan `./components/` recursively and create `.stories.tsx` files next to each component.

```bash
npm run story:generate
```

### Clean stories

Recursively delete all `.stories.tsx` files under `./components`.

```bash
npm run story:clean
```

### Open Storybook

```bash
npm run storybook
```

---

## Expected folder structure

**Before:**

```plaintext
components/
  Button.tsx
  Card/
    Card.tsx
```

**After running `npm run story:generate`:**

```plaintext
components/
  Button.tsx
  Button.stories.tsx
  Card/
    Card.tsx
    Card.stories.tsx
```

**After running `npm run story:clean`:**

```plaintext
components/
  Button.tsx
  Card/
    Card.tsx
```

---

## Code & Folder Structure

```plaintext
/
├─ bin/                  # CLI entry point
├─ src/
│  ├─ commands/
│  │   ├─ generate.ts   # Story generation logic
│  │   └─ clean.ts      # Story cleanup logic
│  ├─ scanner.ts        # Recursive file scanning
│  └─ utils.ts          # Shared utilities
├─ __tests__/            # Unit tests
├─ package.json
└─ README.md
```

---

## Contribution & Collaboration

We welcome contributions from everyone! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/my-feature`).
3. Commit your changes (`git commit -m "feat: add my feature"`).
4. Push your branch (`git push origin feat/my-feature`).
5. Open a pull request against `main`.

### Branching model

- **main** → stable releases
- **dev** → active development

### Reporting issues or requesting features

- Open an issue [here](https://github.com/YOUR_USERNAME/storybook-manager/issues).

---

## Licensing & Contact Information

Licensed under the [MIT License](./LICENSE).

**Maintainers:**

- Your Name — [your.email@example.com](mailto:your.email@example.com)

For support, please open an issue or contact a maintainer directly.
