import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 48 * 1024,
    },
  }),
  manifest: {
    name: 'Focused Todo Roadmap',
    description: 'Turns a YouTube playlist into a dated plan on your new tab.',
    permissions: ['storage', 'alarms'],
  },
});
