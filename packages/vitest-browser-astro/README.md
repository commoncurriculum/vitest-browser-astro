# vitest-browser-astro

Vitest browser mode renderer for Astro components.

## Installation

```shell
npm install vitest-browser-astro
```

## Usage

Configure Vitest to use the Astro browser renderer:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      providerOptions: {
        context: {
          viewport: { width: 1280, height: 720 },
        },
      },
    },
  },
});
```
