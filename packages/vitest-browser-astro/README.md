# vitest-browser-astro

Test Astro components in real browsers with [Vitest Browser Mode](https://vitest.dev/guide/browser/).

Astro components render server-side using the Container API. This library enables browser testing by rendering components on the server and injecting the HTML into the browser DOM for testing with real browser APIs.

## Features

- **Real browser testing** - Run tests in Chromium, Firefox, or WebKit via Playwright or WebdriverIO
- **Testing Library-style API** - Familiar `getByText`, `getByTestId`, `getByRole` locators
- **Framework components** - Test framework components with hydration
- **Interactive components** - Test inline scripts and user interactions
- **Props and slots** - Pass props and slots like in production Astro

## Installation

```bash
npm install -D vitest-browser-astro @vitest/browser playwright
```

Or use pnpm or yarn:

```bash
pnpm add -D vitest-browser-astro @vitest/browser playwright
yarn add -D vitest-browser-astro @vitest/browser playwright
```

## Quick Start

### Configure Vitest

Create `vitest.config.ts`:

```ts
import { getViteConfig } from "astro/config";
import { astroRenderer } from "vitest-browser-astro/plugin";

export default getViteConfig({
	plugins: [astroRenderer()],
	test: {
		browser: {
			enabled: true,
			name: "chromium",
			provider: "playwright",
			headless: true,
		},
	},
});
```

### Write a test

Create a test file next to a component:

```ts
// src/components/Card.test.ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Card from "./Card.astro";

test("renders card title", async () => {
	const screen = await render(Card, {
		props: {
			title: "Hello World",
		},
	});

	await expect.element(screen.getByText("Hello World")).toBeVisible();
});
```

### Run tests

```bash
npx vitest
```

## Testing Framework Components

Framework components (React, Vue, Svelte) require additional configuration to enable hydration in tests.

### Configuration

Add server and client renderers to the plugin options:

```ts
import { getViteConfig } from "astro/config";
import { astroRenderer } from "vitest-browser-astro/plugin";

export default getViteConfig({
	plugins: [
		astroRenderer({
			serverRenderers: [
				{ module: "@astrojs/react/server.js" },
				{ module: "@astrojs/vue/server.js" },
				{ module: "@astrojs/svelte/server.js" },
			],
			clientRenderers: [
				{ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" },
				{ name: "@astrojs/vue", entrypoint: "@astrojs/vue/client.js" },
				{ name: "@astrojs/svelte", entrypoint: "@astrojs/svelte/client.js" },
			],
		}),
	],
	test: {
		browser: {
			enabled: true,
			name: "chromium",
			provider: "playwright",
			headless: true,
		},
	},
});
```

Add the corresponding integration to `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import svelte from "@astrojs/svelte";

export default defineConfig({
	integrations: [react(), vue(), svelte()],
});
```

### Testing hydrated components

Test framework components with the `client:load` directive:

```ts
import { render } from "vitest-browser-astro";
import { userEvent } from "@vitest/browser/context";
import { expect, test } from "vitest";
import Counter from "./Counter.astro";

test("React counter increments on click", async () => {
	const screen = await render(Counter);

	const count = screen.getByTestId("count");
	const button = screen.getByTestId("increment");

	await expect.element(count).toHaveTextContent("0");

	await userEvent.click(button);
	await expect.element(count).toHaveTextContent("1");
});
```

The component being tested:

```astro
---
// Counter.astro
import ReactCounter from "./ReactCounter.tsx";
---

<ReactCounter client:load />
```

### Handling hydration

Framework components with client directives require hydration before they become interactive. Astro wraps these components in `<astro-island>` elements that have an `ssr` attribute during server-side rendering. This attribute is removed once client-side hydration completes.

Call `waitForHydration()` before interacting with framework components to ensure event handlers are attached:

```ts
import { render, waitForHydration } from "vitest-browser-astro";
import { userEvent } from "@vitest/browser/context";
import { expect, test } from "vitest";
import Counter from "./Counter.astro";

test("counter increments after hydration", async () => {
	const screen = await render(Counter);

	// Wait for hydration to complete
	await waitForHydration(screen.container);

	const count = screen.getByTestId("count");
	const button = screen.getByTestId("increment");

	await expect.element(count).toHaveTextContent("0");

	await userEvent.click(button);
	await expect.element(count).toHaveTextContent("1");
});
```

The `waitForHydration()` function accepts an optional timeout parameter (default 5000ms):

```ts
await waitForHydration(screen.container, 10000); // Wait up to 10 seconds
```

Skip `waitForHydration()` for components without client directives or when testing static rendering.

### Supported frameworks

Only one JSX-based framework (React, Preact, or Solid) can be used at a time. The Astro Container API cannot distinguish between different JSX frameworks in the same test configuration. Non-JSX frameworks (Vue, Svelte) can be combined with any JSX framework.

## Testing Interactive Components

Test Astro components with inline scripts using standard user interaction APIs.

### Inline scripts

Components with inline scripts work without additional configuration:

```astro
---
// Toggle.astro
interface Props {
	label: string;
}
const { label } = Astro.props;
---

<button data-testid="toggle">
	{label}: <span data-testid="state">OFF</span>
</button>

<script>
	document.querySelectorAll('[data-testid="toggle"]').forEach((button) => {
		const stateEl = button.querySelector('[data-testid="state"]');
		let isOn = false;

		button.addEventListener("click", () => {
			isOn = !isOn;
			stateEl.textContent = isOn ? "ON" : "OFF";
		});
	});
</script>
```

Test the interactive behavior:

```ts
import { render } from "vitest-browser-astro";
import { userEvent } from "@vitest/browser/context";
import { expect, test } from "vitest";
import Toggle from "./Toggle.astro";

test("toggles state on click", async () => {
	const screen = await render(Toggle, {
		props: { label: "Power" },
	});

	const state = screen.getByTestId("state");
	await expect.element(state).toHaveTextContent("OFF");

	await userEvent.click(screen.getByTestId("toggle"));
	await expect.element(state).toHaveTextContent("ON");

	await userEvent.click(screen.getByTestId("toggle"));
	await expect.element(state).toHaveTextContent("OFF");
});
```

### User interactions

Use `@vitest/browser/context` for user interactions:

```ts
import { userEvent } from "@vitest/browser/context";

// Click elements
await userEvent.click(button);

// Type text
await userEvent.type(input, "Hello");

// Keyboard events
await userEvent.keyboard("{Enter}");

// Hover
await userEvent.hover(element);
```

## Advanced Usage

### Testing with slots

Pass HTML strings as slot content:

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Card from "./Card.astro";

test("renders slot content", async () => {
	const screen = await render(Card, {
		props: { title: "Card Title" },
		slots: {
			default: "<p>Main content</p>",
			footer: "<small>Footer text</small>",
		},
	});

	await expect.element(screen.getByText("Main content")).toBeInTheDocument();
	await expect.element(screen.getByText("Footer text")).toBeInTheDocument();
});
```

### Complex prop types

Props serialize automatically using [devalue](https://github.com/rich-harris/devalue), supporting Dates, RegExps, Maps, Sets, and other non-JSON types:

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Post from "./Post.astro";

test("handles Date props", async () => {
	const screen = await render(Post, {
		props: {
			title: "My Post",
			publishedAt: new Date("2024-01-15T10:00:00Z"),
			tags: new Set(["astro", "testing"]),
			metadata: new Map([["author", "Jane"]]),
		},
	});

	await expect.element(screen.getByText(/January 15, 2024/)).toBeVisible();
});
```

### Manual cleanup

The library calls `cleanup()` automatically between tests. Call it manually when needed:

```ts
import { render, cleanup } from "vitest-browser-astro";
import { test } from "vitest";
import Card from "./Card.astro";

test("manual cleanup", async () => {
	const screen = await render(Card, {
		props: { title: "Test" },
	});

	// Test something...

	screen.unmount(); // Remove this component
	// or
	await cleanup(); // Remove all components
});
```

## API Reference

### `render(component, options?)`

Renders an Astro component and returns locators for querying the DOM.

**Parameters:**

- `component` - Imported Astro component
- `options` - Optional configuration:
  - `props` - Props to pass to the component
  - `slots` - Object mapping slot names to HTML strings
  - `container` - Custom container element (default: `document.body`)
  - `baseElement` - Base element for queries (default: `container`)

**Returns** a `RenderResult` object:

- `container` - DOM element containing the rendered component
- `baseElement` - Base element for queries
- `getByText(text)` - Find element by text content
- `getByTestId(id)` - Find element by `data-testid` attribute
- `getByRole(role)` - Find element by ARIA role
- `unmount()` - Remove the component from the DOM
- `debug()` - Log the DOM structure

### `cleanup()`

Removes all rendered components from the DOM. Runs automatically between tests via `beforeEach`.

### `waitForHydration(container, timeout?)`

Waits for Astro island hydration to complete before proceeding with interactions.

**Parameters:**

- `container` - The container element to search for islands (typically `screen.container`)
- `timeout` - Optional maximum wait time in milliseconds (default: 5000)

**Returns:** `Promise<void>`

**Throws:** Error if hydration does not complete within the timeout period

This function checks for `<astro-island>` elements with the `ssr` attribute and waits for the attribute to be removed, indicating hydration is complete. Call this before interacting with framework components that use client directives.

## Configuration

### Plugin options

Configure the `astroRenderer` plugin with framework support:

```ts
astroRenderer({
	serverRenderers: [
		{ module: "@astrojs/react/server.js" },
		{ module: "@astrojs/vue/server.js" },
		{ module: "@astrojs/svelte/server.js" },
	],
	clientRenderers: [
		{ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" },
		{ name: "@astrojs/vue", entrypoint: "@astrojs/vue/client.js" },
		{ name: "@astrojs/svelte", entrypoint: "@astrojs/svelte/client.js" },
	],
});
```

**Options:**

- `serverRenderers` - Array of server renderer configurations for SSR
  - `module` - Path to the server renderer module
- `clientRenderers` - Array of client renderer configurations for hydration
  - `name` - Integration name
  - `entrypoint` - Path to the client renderer entrypoint

### Browser providers

#### Playwright

```ts
export default getViteConfig({
	test: {
		browser: {
			enabled: true,
			name: "chromium", // or 'firefox', 'webkit'
			provider: "playwright",
			headless: true,
		},
	},
});
```

#### WebdriverIO

```ts
export default getViteConfig({
	test: {
		browser: {
			enabled: true,
			name: "chrome",
			provider: "webdriverio",
		},
	},
});
```

### Optimizing dependencies

Add framework dependencies to `optimizeDeps` when needed:

```ts
export default getViteConfig({
	plugins: [astroRenderer(/* ... */)],
	optimizeDeps: {
		include: ["react", "react-dom", "react-dom/client"],
	},
	test: {
		browser: {
			enabled: true,
			name: "chromium",
			provider: "playwright",
		},
	},
});
```

## Troubleshooting

### Module not found errors

Install all required dependencies:

```bash
npm install -D vitest @vitest/browser playwright astro vite
```

For framework components, install the corresponding packages:

```bash
# React
npm install -D react react-dom @astrojs/react

# Vue
npm install -D vue @astrojs/vue

# Svelte
npm install -D svelte @astrojs/svelte
```

### TypeScript errors with `.astro` imports

Ensure `tsconfig.json` extends Astro's base configuration:

```json
{
	"extends": "astro/tsconfigs/base"
}
```

Then restart the TypeScript server in the IDE.

### Tests hanging or timing out

1. Verify `browser.enabled: true` in the Vitest config
2. Install Playwright browsers: `npx playwright install`
3. Run with `headless: false` to debug visually
4. Check browser console output for errors

### Components not rendering

1. Verify `astroRenderer()` appears in the `plugins` array
2. Confirm use of `getViteConfig()` from `astro/config`
3. Check that imports use `.astro` extensions, not `.ts` or `.tsx`
4. For framework components, verify both server and client renderers are configured

### Framework component hydration not working

1. Add the framework to both `serverRenderers` and `clientRenderers`
2. Install the corresponding `@astrojs/*` integration package
3. Add the integration to `astro.config.mjs`
4. Use the `client:load` directive on framework components in `.astro` files
5. Check that `optimizeDeps.include` contains necessary framework packages

## Requirements

- Astro 5.x or later
- Vitest 3.x or later
- Vite 6.x or later

## Contributing

Contributions are welcome. Check the [GitHub repository](https://github.com/ascorbic/vitest-browser-astro) for issues and pull requests.

## License

MIT © [Matt Kane](https://github.com/ascorbic)
