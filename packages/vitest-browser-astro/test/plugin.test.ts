import { describe, it, expect } from 'vitest';
import { astroRenderer } from '../src/plugin';

// Helper to extract transform function from plugin hook
function getTransform(plugin: ReturnType<typeof astroRenderer>) {
	const transform = plugin.transform;
	if (!transform) return null;
	return typeof transform === 'function' ? transform : transform.handler;
}

describe('astroRenderer plugin', () => {
	it('should have the correct name', () => {
		const plugin = astroRenderer();
		expect(plugin.name).toBe('vitest:astro-renderer');
	});

	it('should enforce "post" to run after Astro transforms', () => {
		const plugin = astroRenderer();
		expect(plugin.enforce).toBe('post');
	});

	it('should have config hook', () => {
		const plugin = astroRenderer();
		expect(plugin.config).toBeTypeOf('function');
	});

	describe('transform hook', () => {
		it('should intercept browser imports of .astro files', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const id = '/path/to/Component.astro';
			const code = '/* some astro transformed code */';
			const options = { ssr: false };

			const result = await transform?.call({} as any, code, id, options);

			expect(result).toBeTruthy();
			expect(typeof result).toBe('string');
			expect(result).toContain('__astroComponent: true');
			expect(result).toContain('__path:');
			expect(result).toContain('__name: "default"');
		});

		it('should include the full path in metadata', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const id = '/absolute/path/to/Card.astro';
			const code = '/* code */';
			const options = { ssr: false };

			const result = await transform?.call({} as any, code, id, options);

			expect(result).toContain(JSON.stringify(id));
		});

		it('should NOT intercept SSR imports of .astro files', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const id = '/path/to/Component.astro';
			const code = '/* code */';
			const options = { ssr: true };

			const result = await transform?.call({} as any, code, id, options);

			expect(result).toBeNull();
		});

		it('should NOT intercept non-.astro files', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const code = '/* code */';
			const options = { ssr: false };

			expect(await transform?.call({} as any, code, '/path/to/file.ts', options)).toBeNull();
			expect(await transform?.call({} as any, code, '/path/to/file.tsx', options)).toBeNull();
			expect(await transform?.call({} as any, code, '/path/to/file.js', options)).toBeNull();
			expect(await transform?.call({} as any, code, '/path/to/file.jsx', options)).toBeNull();
		});
	});

	describe('generated metadata object', () => {
		it('should be a valid export default statement', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const code = '/* code */';
			const options = { ssr: false };

			const result = await transform?.call({} as any, code, '/path/to/Component.astro', options);

			expect(result).toContain('export default');
		});

		it('should have __astroComponent flag', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const code = '/* code */';
			const options = { ssr: false };

			const result = await transform?.call({} as any, code, '/path/to/Component.astro', options);

			expect(result).toMatch(/__astroComponent:\s*true/);
		});

		it('should have __path property', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const code = '/* code */';
			const options = { ssr: false };

			const result = await transform?.call({} as any, code, '/path/to/Component.astro', options);

			expect(result).toMatch(/__path:\s*"/);
		});

		it('should have __name property set to "default"', async () => {
			const plugin = astroRenderer();
			const transform = getTransform(plugin);
			const code = '/* code */';
			const options = { ssr: false };

			const result = await transform?.call({} as any, code, '/path/to/Component.astro', options);

			expect(result).toMatch(/__name:\s*"default"/);
		});
	});
});
