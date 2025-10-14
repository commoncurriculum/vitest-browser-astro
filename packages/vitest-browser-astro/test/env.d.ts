/// <reference types="astro/client" />

// Allow importing .astro files in test files
declare module '*.astro' {
	const component: {
		__astroComponent: true;
		__path: string;
		__name: string;
	};
	export default component;
}
