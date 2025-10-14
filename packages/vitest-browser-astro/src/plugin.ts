import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { BrowserCommand } from 'vitest/node';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'devalue';

type RenderAstroCommand = BrowserCommand<
	[componentPath: string, componentName: string, serializedProps?: string, slots?: Record<string, string>]
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
	const module = await viteServer.ssrLoadModule(absolutePath);

	// Get the component (default export or named export)
	const Component = module.default || module[componentName];

	if (!Component) {
		throw new Error(
			`Component "${componentName}" not found in ${absolutePath}. Available exports: ${Object.keys(module).join(', ')}`,
		);
	}

	// Deserialize props using devalue to restore Dates, RegExps, etc.
	const props = serializedProps ? parse(serializedProps) : undefined;

	// Create Astro container for rendering
	const container = await AstroContainer.create();

	// Render the component to HTML string
	const html = await container.renderToString(Component, {
		props,
		slots,
		request: new Request('http://localhost:3000/test'),
	});

	return { html };
};

/**
 * Vite plugin that intercepts .astro imports and provides browser command
 */
export function astroRenderer(): Plugin {
	return {
		name: 'vitest:astro-renderer',
		enforce: 'post',

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

		async transform(code, id, options) {
			// Only intercept browser imports of .astro files (after Astro has processed SSR)
			if (id.endsWith('.astro') && !options?.ssr) {
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
	};
}
