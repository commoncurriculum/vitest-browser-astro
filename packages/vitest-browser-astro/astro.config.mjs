import { defineConfig } from "astro/config";

// Minimal Astro config for testing
// This provides SSR support for loading .astro components
export default defineConfig({
	// No src directory - using test fixtures directly
	srcDir: "./test/fixtures/astro-site/src",
});
