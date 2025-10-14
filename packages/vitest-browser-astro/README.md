# vitest-browser-astro

Test your Astro components in real browsers with [Vitest Browser Mode](https://vitest.dev/guide/browser/).

Astro components can only be rendered server-side using the Container API. This library bridges that gap by letting you write tests that run in an actual browser (via Playwright or WebdriverIO) while rendering your Astro components on the server and injecting the HTML into the browser DOM.

## Features

- ✅ **Real browser testing** - Tests run in Chromium, Firefox, or WebKit via Playwright/WebdriverIO
- ✅ **Server-side rendering** - Uses Astro's Container API to render components with full SSR support
- ✅ **Testing Library-style API** - Familiar `getByText`, `getByTestId`, `getByRole` locators
- ✅ **Props & slots support** - Pass props and slots just like in real Astro usage
- ✅ **Complex data types** - Automatically serializes Dates, RegExps, and other non-JSON types using `devalue`
- ✅ **Full TypeScript support** - Complete type safety for components, props, and locators

## Installation

```bash
npm install -D vitest-browser-astro @vitest/browser playwright
```

Or with your preferred package manager:

```bash
pnpm add -D vitest-browser-astro @vitest/browser playwright
yarn add -D vitest-browser-astro @vitest/browser playwright
```

## Quick Start

### 1. Configure Vitest

Create a `vitest.config.ts` in your Astro project:

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

### 2. Write Your First Test

```ts
// src/components/Card.test.ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Card from "./Card.astro";

test("renders card with title and content", async () => {
	const screen = await render(Card, {
		props: {
			title: "Hello World",
			content: "This is a test card",
		},
	});

	await expect.element(screen.getByText("Hello World")).toBeVisible();
	await expect
		.element(screen.getByText("This is a test card"))
		.toBeInTheDocument();
});
```

### 3. Run Tests

```bash
npm test
```

## API Reference

### `render(component, options?)`

Renders an Astro component and returns locators for querying the DOM.

#### Parameters

- **`component`** - The imported Astro component
- **`options`** - Optional configuration object:
  - **`props`** - Props to pass to the component
  - **`slots`** - Slots content as `{ slotName: 'HTML string' }`
  - **`container`** - Custom container element (defaults to `document.body`)
  - **`baseElement`** - Element for queries (defaults to `container`)

#### Returns

A `RenderResult` object with:

- **`container`** - The DOM element containing the rendered component
- **`baseElement`** - The base element for queries
- **`getByText(text)`** - Find element by text content
- **`getByTestId(id)`** - Find element by `data-testid` attribute
- **`getByRole(role)`** - Find element by ARIA role
- **`unmount()`** - Remove the component from the DOM
- **`debug()`** - Log the DOM structure

### `cleanup()`

Removes all rendered components from the DOM. Automatically called between tests via `beforeEach`.

## Examples

### Testing with Props

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Button from "./Button.astro";

test("button shows correct label", async () => {
	const screen = await render(Button, {
		props: {
			label: "Click me",
			variant: "primary",
		},
	});

	const button = screen.getByRole("button");
	await expect.element(button).toHaveTextContent("Click me");
	await expect.element(button).toHaveClass("btn-primary");
});
```

### Testing with Slots

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Card from "./Card.astro";

test("renders slot content", async () => {
	const screen = await render(Card, {
		props: { title: "My Card" },
		slots: {
			default: "<p>Slot content here</p>",
		},
	});

	await expect
		.element(screen.getByText("Slot content here"))
		.toBeInTheDocument();
});
```

### Testing with Complex Props

Props are automatically serialized using [`devalue`](https://github.com/rich-harris/devalue), so you can pass Dates, RegExps, Maps, Sets, and other complex types:

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import BlogPost from "./BlogPost.astro";

test("formats date correctly", async () => {
	const screen = await render(BlogPost, {
		props: {
			title: "My Post",
			publishedAt: new Date("2024-01-01T00:00:00Z"),
			tags: ["astro", "testing"],
		},
	});

	await expect.element(screen.getByText(/January 1, 2024/)).toBeInTheDocument();
});
```

### User Interactions

Use Vitest's browser context to simulate user interactions:

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import Counter from "./Counter.astro";

test("clicking button increments counter", async () => {
	const screen = await render(Counter);

	const button = screen.getByRole("button");
	const count = screen.getByTestId("count");

	await expect.element(count).toHaveTextContent("0");

	await userEvent.click(button);
	await expect.element(count).toHaveTextContent("1");
});
```

### Cleanup

By default, `cleanup()` runs automatically between tests. You can also call it manually:

```ts
import { render, cleanup } from "vitest-browser-astro";
import { test } from "vitest";
import Card from "./Card.astro";

test("manual cleanup", async () => {
	const screen = await render(Card, { props: { title: "Test" } });

	// Do something...

	screen.unmount(); // or cleanup()
});
```

## How It Works

1. **Import Interception** - The Vite plugin intercepts `.astro` imports and replaces them with metadata objects in the browser context
2. **Browser Command** - When you call `render()`, it invokes a browser command that runs on the Node.js side
3. **SSR Rendering** - The command uses Astro's Container API to render the component to an HTML string
4. **DOM Injection** - The HTML is sent back to the browser and injected into the DOM using `createContextualFragment`
5. **Locators** - You get Testing Library-style locators to query and interact with the rendered component

## Configuration

### Using with Astro's Config

The recommended setup uses `getViteConfig()` from Astro to automatically load all Astro plugins:

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
		},
	},
});
```

### Browser Provider Options

#### Playwright (Recommended)

```ts
export default getViteConfig({
	test: {
		browser: {
			enabled: true,
			name: "chromium", // or 'firefox', 'webkit'
			provider: "playwright",
			headless: true,
			screenshotFailures: false,
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

## TypeScript Support

The library includes full TypeScript support. Your `.astro` imports will have proper types:

```ts
import Card from "./Card.astro"; // ✅ Typed as AstroComponentFactory

const screen = await render(Card, {
	props: {
		title: "Hello", // ✅ Type-checked against Card's Props
	},
});
```

If you encounter TypeScript errors with `.astro` imports, ensure your `tsconfig.json` extends Astro's base config:

```json
{
	"extends": "astro/tsconfigs/base"
}
```

## Troubleshooting

### Module not found errors

Make sure you've installed all peer dependencies:

```bash
npm install -D vitest @vitest/browser playwright astro vite
```

### `.astro` import errors in IDE

1. Ensure your `tsconfig.json` extends `astro/tsconfigs/base`
2. Restart your TypeScript server
3. Check that you have the plugin configured in your Vitest config

### Tests hanging or timing out

1. Make sure `browser.enabled: true` is set in your Vitest config
2. Check that Playwright browsers are installed: `npx playwright install`
3. Try running with `headless: false` to debug visually

### Components not rendering

1. Verify the plugin is loaded: `astroRenderer()` should be in your Vite plugins array
2. Check that you're using `getViteConfig()` from `astro/config`
3. Ensure you're importing `.astro` files, not `.ts` or `.tsx`

## Requirements

- **Astro** 5.x or later (uses Container API)
- **Vitest** 3.x or later (browser mode)
- **Vite** 6.x or later (required by Astro 5)
- **Node.js** 16.x or later

## Contributing

Contributions are welcome! Please check the [GitHub repository](https://github.com/ascorbic/vitest-browser-astro) for issues and pull requests.

## License

MIT © [Matt Kane](https://github.com/ascorbic)
