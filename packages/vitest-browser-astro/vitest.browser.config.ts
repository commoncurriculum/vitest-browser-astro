/// <reference types="vitest" />
import { getViteConfig } from "astro/config";
import { astroRenderer } from "./src/plugin";

export default getViteConfig({
	plugins: [astroRenderer()],
	test: {
		// Browser integration tests
		include: ["test/browser.test.ts"],
		browser: {
			enabled: true,
			name: "chromium",
			provider: "playwright",
			headless: true,
		},
	},
});
