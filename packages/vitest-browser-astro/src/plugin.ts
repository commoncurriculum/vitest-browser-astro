import { resolve } from "node:path";
import type { Plugin } from "vite";
import type { BrowserCommand } from "vitest/node";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "devalue";

type RenderAstroCommand = BrowserCommand<
	[
		componentPath: string,
		componentName: string,
		serializedProps?: string,
		slots?: Record<string, string>,
	]
>;

/**
 * Browser command that runs in Node.js to render Astro components
 */
const renderAstroCommand: RenderAstroCommand = async (
	ctx,
	componentPath: string,
	componentName: string,
	serializedProps?: string,
	slots?: Record<string, string>,
) => {
	const projectRoot = process.cwd();
	const absolutePath = resolve(projectRoot, componentPath);

	// Use Vitest's Vite server which already has Astro configured
	const viteServer = ctx.project.vite;

	// Load the component directly (astro-head-inject will be auto-injected during SSR)
	const componentModule = await viteServer.ssrLoadModule(absolutePath);

	// Get the component
	const Component = componentModule.default || componentModule[componentName];

	if (!Component) {
		throw new Error(
			`Component not found for ${absolutePath}. Available exports: ${Object.keys(componentModule).join(", ")}`,
		);
	}

	// Deserialize props using devalue to restore Dates, RegExps, etc.
	const props = serializedProps ? parse(serializedProps) : undefined;

	// Create Astro container for rendering
	const container = await AstroContainer.create();

	// Render the component (which will include scripts due to astro-head-inject)
	const html = await container.renderToString(Component, {
		props,
		slots,
		request: new Request("http://localhost:3000/test"),
	});

	return { html };
};

/**
 * Vite plugin that intercepts .astro imports and provides browser command
 * Returns array of two plugins: one for pre-processing, one for post-processing
 */
export function astroRenderer(): Plugin[] {
	return [
		{
			name: "vitest:astro-renderer:pre",
			enforce: "pre",

			async transform(code, id, options) {
				// For SSR loads of .astro files, inject astro-head-inject comment at the top
				if (id.endsWith(".astro") && options?.ssr) {
					// Add the comment at the very top of the compiled JS
					return `// astro-head-inject\n${code}`;
				}
				return null;
			},
		},
		{
			name: "vitest:astro-renderer",
			enforce: "post",

			config() {
				return {
					test: {
						browser: {
							commands: {
								renderAstro: renderAstroCommand,
							},
						},
					},
				};
			},

			async transform(_code, id, options) {
				// Only intercept browser imports of .astro files (after Astro has processed them)
				if (id.endsWith(".astro") && !options?.ssr) {
					// Replace entire transformed code with metadata object
					return `
export default {
	__astroComponent: true,
	__path: ${JSON.stringify(id)},
	__name: "default",
};
					`.trim();
				}
				return null;
			},
		},
	];
}
