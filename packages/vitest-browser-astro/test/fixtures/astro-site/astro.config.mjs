import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import svelte from "@astrojs/svelte";

export default defineConfig({
	integrations: [
		react({ include: ["**/React*.{tsx,astro}"] }),
		vue(),
		svelte(),
	],
});
