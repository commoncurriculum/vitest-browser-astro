import { defineConfig } from "astro/config";

export default defineConfig({
	// Minimal config for testing
	vite: {
		ssr: {
			// Exclude Vitest browser files from SSR processing
			noExternal: [],
		},
	},
});
