/// <reference types="vitest" />
import { getViteConfig } from "astro/config";
import { astroRenderer } from "vitest-browser-astro/plugin";

export default getViteConfig({
	plugins: [
		astroRenderer({
			serverRenderers: [{ module: "@astrojs/react/server.js" }],
			clientRenderers: [
				{ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" },
			],
		}),
	],
	test: {
		// Browser integration tests
		include: ["test/**/*.test.ts"],
		browser: {
			enabled: true,
			instances: [{ browser: "chromium" }],
			provider: "playwright",
			headless: true,
		},
	},
});
