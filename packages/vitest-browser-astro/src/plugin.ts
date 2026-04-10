import { isAbsolute, resolve } from "node:path";
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
 * Walk the SSR module graph from an entry point and collect CSS.
 *
 * For each .css dependency, call `server.transformRequest(id)` — this returns
 * a JS module that assigns the fully-processed CSS to `const __vite__css = "..."`
 * alongside the CSS module class exports. Both come from the same lightningcss
 * pass, so the hash in the CSS (including grid-template-areas, grid-area, and
 * selectors) matches the hash returned by the Astro container's SSR render.
 *
 * The host vitest config must set `test.css: true` to bypass vitest's
 * css-disable plugin, which would otherwise replace the CSS with a Proxy stub.
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
			const result = await server.transformRequest(cssId);
			if (!result?.code) continue;

			// The bare CSS transform produces a JS module containing:
			//   const __vite__css = "...processed css...";
			//   (0,__vite_ssr_import_1__.updateStyle)(__vite__id, __vite__css);
			// Extract the CSS string literal. Using [\s\S] to span newlines.
			const match = result.code.match(
				/const __vite__css = "((?:[^"\\]|\\[\s\S])*)"/,
			);
			if (!match) continue;

			// Unescape the JS string literal back into raw CSS.
			// Order matters: unescape \\ last so earlier backslash sequences
			// don't get re-interpreted.
			const css = match[1]
				.replace(/\\n/g, "\n")
				.replace(/\\r/g, "\r")
				.replace(/\\t/g, "\t")
				.replace(/\\"/g, '"')
				.replace(/\\\\/g, "\\");

			chunks.push(css);
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

		const viteServer = ctx.project.vite;
		const componentModule = await viteServer.ssrLoadModule(absolutePath);
		const Component = componentModule.default || componentModule[componentName];

		if (!Component) {
			throw new Error(
				`Component ${componentName} not found for ${absolutePath}. Available exports: ${Object.keys(componentModule).join(", ")}`,
			);
		}

		const props = serializedProps ? parse(serializedProps) : undefined;

		const html = await container.renderToString(Component, {
			props,
			slots,
			request: new Request("http://localhost:4321/"),
		});

		const css = await collectSsrCss(viteServer, absolutePath);

		return { html, css };
	};
}

export interface AstroRendererOptions {
	renderers?: AstroRenderer[];
}

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

			if (config.ssr.noExternal === true) {
				// @ts-expect-error - mutating readonly config to fix CJS compatibility
				config.ssr.noExternal = [];
			}

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
			if (id.endsWith(".astro") && !options?.ssr) {
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
