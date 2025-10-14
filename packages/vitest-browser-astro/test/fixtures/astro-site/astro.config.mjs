import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
	// Minimal config for testing
	integrations: [react()],
	vite: {
		ssr: {
			// Exclude Vitest browser files from SSR processing
			noExternal: [],
		},
	},
});
