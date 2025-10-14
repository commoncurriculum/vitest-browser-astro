import { commands } from '@vitest/browser/context';
import { beforeEach } from 'vitest';
import { stringify } from 'devalue';
import { cleanup, injectHTML } from './pure';
import type { AstroComponentMetadata, RenderOptions, RenderResult } from './types';

// Export types
export type { AstroComponentMetadata, RenderOptions, RenderResult } from './types';

// Export utilities
export { cleanup, injectHTML } from './pure';

/**
 * Renders an Astro component in the browser using Vitest browser mode
 *
 * @param component - The imported Astro component (will be metadata object after plugin transform)
 * @param options - Render options including props and slots
 * @returns RenderResult with container, locators, and cleanup functions
 *
 * @example
 * ```ts
 * import { render } from 'vitest-browser-astro';
 * import Card from './Card.astro';
 *
 * test('renders card', async () => {
 *   const screen = await render(Card, {
 *     props: { title: 'Hello' }
 *   });
 *   await expect.element(screen.getByText('Hello')).toBeVisible();
 * });
 * ```
 */
export async function render(
	component: AstroComponentMetadata,
	options: RenderOptions = {},
): Promise<RenderResult> {
	// Validate that this is an Astro component metadata object
	if (!component || !component.__astroComponent) {
		throw new Error(
			'Not an Astro component. Make sure you imported an .astro file and the vitest-browser-astro plugin is configured.',
		);
	}

	// Serialize props using devalue to preserve Dates, RegExps, etc.
	const serializedProps = options.props ? stringify(options.props) : undefined;

	// Call the browser command to render in Node.js
	const { html } = await commands.renderAstro(
		component.__path,
		component.__name,
		serializedProps,
		options.slots,
	);

	// Inject the HTML into the browser DOM
	return injectHTML(html, {
		container: options.container,
		baseElement: options.baseElement,
	});
}

// Automatically cleanup between tests
beforeEach(async () => {
	await cleanup();
});

// Extend Vitest browser context types
declare module '@vitest/browser/context' {
	interface BrowserCommands {
		renderAstro: (
			componentPath: string,
			componentName: string,
			serializedProps?: string,
			slots?: Record<string, string>,
		) => Promise<{ html: string }>;
	}
}
