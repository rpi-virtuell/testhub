import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Zwei Build-Varianten:
//  - Standard (`vite build`): statische Seite in dist/ für GitHub Pages (base './').
//  - Single (`vite build --mode single`): EINE eigenständige HTML-Datei in dist-single/.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [preact(), viteSingleFile()] : [preact()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
}));
