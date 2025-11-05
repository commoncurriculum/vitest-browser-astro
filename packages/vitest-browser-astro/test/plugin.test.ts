import { describe, it, expect } from "vitest";
import { astroRenderer } from "../src/plugin";

describe("astroRenderer plugin", () => {
	const ctx = {} as any;
	it("should transform browser imports of .astro files to metadata objects", async () => {
		const plugin = astroRenderer();
		const transform = plugin?.transform;
		if (!transform || typeof transform !== "function") {
			throw new Error("Transform hook not found");
		}

		const id = "/path/to/Component.astro";
		const code = "/* some astro transformed code */";
		const options = { ssr: false };

		const result = await transform.call(ctx, code, id, options);

		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");
		expect(result).toContain("__astroComponent: true");
		expect(result).toContain(`__path: ${JSON.stringify(id)}`);
		expect(result).toContain('__name: "default"');
	});

	it("should NOT transform SSR imports of .astro files", async () => {
		const plugin = astroRenderer();
		const transform = plugin?.transform;
		if (!transform || typeof transform !== "function") {
			throw new Error("Transform hook not found");
		}

		const id = "/path/to/Component.astro";
		const code = "/* code */";
		const options = { ssr: true };

		const result = await transform.call(ctx, code, id, options);

		expect(result).toBeNull();
	});

	it("should NOT transform non-.astro files", async () => {
		const plugin = astroRenderer();
		const transform = plugin?.transform;
		if (!transform || typeof transform !== "function") {
			throw new Error("Transform hook not found");
		}

		const code = "/* code */";
		const options = { ssr: false };

		expect(
			await transform.call(ctx, code, "/path/to/file.ts", options),
		).toBeNull();
		expect(
			await transform.call(ctx, code, "/path/to/file.tsx", options),
		).toBeNull();
		expect(
			await transform.call(ctx, code, "/path/to/file.js", options),
		).toBeNull();
	});
});
