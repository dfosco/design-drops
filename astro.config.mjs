import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://dfosco.github.io',
  base: '/design-drops',
  output: 'static',
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
  },
});
