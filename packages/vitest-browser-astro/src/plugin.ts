import { isAbsolute, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import type { BrowserCommand } from "vitest/node";
import type { ViteDevServer } from "vite";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "devalue";
import type { AstroRenderer, SSRLoadedRenderer } from "astro";

type RenderAstroCommand = BrowserCommand<
	[
		componentPath: string,
		componentName: string,
		serializedProps?: string,
		slots?: Record<string, string>,
	]
>;

/**
 * Loads renderer modules using Vite's SSR loader and adds them to the container
 * Mimics the behavior of loadRenderers() from astro:container
 */
async function loadRenderers(
	renderers: AstroRenderer[],
	server: ViteDevServer,
) {
	const loadedRenderers = await Promise.all(
		renderers.map(async (renderer) => {
			const mod = await server.ssrLoadModule(
				renderer.serverEntrypoint.toString(),
			);
			let { clientEntrypoint, name } = renderer;
			if (
				!clientEntrypoint &&
				name.startsWith("@astrojs/") &&
				name !== "@astrojs/mdx"
			) {
				// Hacky workaround because astro < 5.16.0 doesn't provide clientEntrypoint for official renderers
				clientEntrypoint = renderer.serverEntrypoint
					.toString()
					.replace("/server.js", "/client.js");
			}
			if (typeof mod.default !== "undefined") {
				return {
					...renderer,
					clientEntrypoint,
					ssr: mod.default,
				} as SSRLoadedRenderer;
			}
			return undefined;
		}),
	);

	return loadedRenderers.filter((r): r is SSRLoadedRenderer => Boolean(r));
}

/**
 * Walk the SSR module graph from an entry point and collect CSS files.
 * For each CSS module found, read the raw CSS and rewrite class names to
 * match the hashed names used by the SSR Proxy (e.g., _className_hash).
 *
 * Why not use transformRequest? In Vitest's context, transformRequest returns
 * the SSR transform (a JS Proxy for class name mappings), not the browser
 * transform with actual CSS. So we read the raw CSS and apply the same hash.
 */
async function collectSsrCss(
	server: ViteDevServer,
	entryId: string,
): Promise<string> {
	const cssIds = new Set<string>();
	const visited = new Set<string>();

	function walk(id: string) {
		if (visited.has(id)) return;
		visited.add(id);

		const mod = server.moduleGraph.getModuleById(id);
		if (!mod) return;

		if (mod.id && /\.css($|\?)/.test(mod.id)) {
			cssIds.add(mod.id);
		}

		for (const dep of mod.ssrImportedModules) {
			if (dep.id) walk(dep.id);
		}
	}

	walk(entryId);

	const chunks: string[] = [];
	for (const cssId of cssIds) {
		try {
			// Get the file path (strip query params)
			const filePath = cssId.split("?")[0];

			// Detect the hash suffix by calling the SSR module's Proxy
			const ssrMod = await server.ssrLoadModule(cssId);
			const classMap = ssrMod?.default;
			if (!classMap || typeof classMap !== "object") continue;

			// Get any class name to extract the hash suffix
			// The SSR Proxy returns `_${style}_${hash}` for any property access
			const sampleName = classMap["__probe__"] as string;
			// Extract hash: "__probe__" → "_probe___hash" → hash is after the last _
			const hashMatch = sampleName?.match(/_([a-f0-9]+)$/);
			if (!hashMatch) continue;
			const hash = hashMatch[1];

			// Read raw CSS file
			const rawCss = await readFile(filePath, "utf-8");

			// Rewrite CSS class selectors: .className → ._className_hash
			// This matches Vite's CSS module hashing convention
			const rewritten = rawCss.replace(
				/\.([a-zA-Z_][\w-]*)/g,
				(_, name) => `._${name}_${hash}`,
			);

			chunks.push(rewritten);
		} catch {
			// Skip files that can't be processed
		}
	}

	return chunks.join("\n");
}

/**
 * Creates the browser command with a pre-configured container
 */
async function createRenderAstroCommand(
	container: AstroContainer,
): Promise<RenderAstroCommand> {
	return async (
		ctx,
		componentPath: string,
		componentName: string,
		serializedProps?: string,
		slots?: Record<string, string>,
	) => {
		const projectRoot = ctx.project.config.root;
		const absolutePath = resolve(projectRoot, componentPath);

		// Use Vitest's Vite server which already has Astro configured
		const viteServer = ctx.project.vite;

		const componentModule = await viteServer.ssrLoadModule(absolutePath);

		const Component = componentModule.default || componentModule[componentName];

		if (!Component) {
			throw new Error(
				`Component ${componentName} not found for ${absolutePath}. Available exports: ${Object.keys(componentModule).join(", ")}`,
			);
		}

		// Deserialize props using devalue to restore Dates, RegExps, etc.
		const props = serializedProps ? parse(serializedProps) : undefined;

		const html = await container.renderToString(Component, {
			props,
			slots,
			request: new Request("http://localhost:4321/"),
		});

		// Collect CSS from the Vite module graph for all modules loaded during SSR.
		// Astro Container API's renderToString doesn't include component CSS
		// (CSS modules, scoped styles). Walk the module graph starting from the
		// component and collect CSS content via Vite's transform pipeline.
		const css = await collectSsrCss(viteServer, absolutePath);

		return { html, css };
	};
}

/**
 * Options for configuring the Astro renderer plugin
 */
export interface AstroRendererOptions {
	/**
	 * Framework renderers for SSR and hydration
	 * Use getContainerRenderer() from your framework integration packages
	 * @example
	 * import { getContainerRenderer as reactRenderer } from '@astrojs/react';
	 * import { getContainerRenderer as vueRenderer } from '@astrojs/vue';
	 *
	 * renderers: [reactRenderer(), vueRenderer()]
	 */
	renderers?: AstroRenderer[];
}

/**
 * Vite plugin that intercepts .astro imports and provides browser command
 * Returns array of two plugins: one for pre-processing, one for post-processing
 */
export function astroRenderer(options: AstroRendererOptions = {}): Plugin {
	let renderAstroCommand: RenderAstroCommand | null = null;

	return {
		name: "vitest:astro-renderer",
		enforce: "post",

		async configureServer(server) {
			const renderers = await loadRenderers(options.renderers || [], server);
			const container = await AstroContainer.create({
				renderers,
				resolve: async (id) => {
					const resolved = await server.pluginContainer.resolveId(
						id,
						undefined,
					);
					if (resolved && isAbsolute(resolved?.id)) {
						return `/@fs${resolved.id}`;
					}
					return `/@id/${resolved?.id ?? id}`;
				},
			});

			// Create browser command
			renderAstroCommand = await createRenderAstroCommand(container);
		},

		config(config, { command }) {
			return {
				optimizeDeps: {
					include: ["react", "react-dom", "react-dom/client"],
				},
				test: {
					browser: {
						commands: {
							renderAstro: ((...args) => {
								if (!renderAstroCommand) {
									throw new Error("renderAstroCommand not initialized");
								}
								return renderAstroCommand(...args);
							}) as RenderAstroCommand,
						},
					},
				},
			};
		},

		configResolved(config) {
			// Override Astro's ssr.noExternal: true to allow CJS packages to be externalized
			// Astro sets noExternal: true which forces all packages through Vite's Module Runner
			// But CJS packages fail in the Module Runner's ESModulesEvaluator
			// We need to set noExternal to a specific list instead of true
			const cjsPackages = [
				"react",
				"react-dom",
				"vue",
				"svelte",
				"picocolors",
				"cssesc",
				"string-width",
				"prismjs",
			];

			// If noExternal is true, convert it to array excluding CJS packages
			if (config.ssr.noExternal === true) {
				// @ts-expect-error - mutating readonly config to fix CJS compatibility
				config.ssr.noExternal = [];
			}

			// Ensure CJS packages are in the external list
			const external = config.ssr.external;
			if (Array.isArray(external)) {
				for (const pkg of cjsPackages) {
					if (!external.includes(pkg)) {
						// @ts-expect-error - mutating readonly config to fix CJS compatibility
						external.push(pkg);
					}
				}
			}
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
	};
}
