import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    tv_mode: 'src/index.ts',
    lab_app: 'src/lab/TVTestLab.ts',
    prime_bridge: 'src/prime/prime_bridge.ts'
  },
  format: ['iife'],
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: false,
  dts: false,
  minify: false,
  target: 'es2022',
  outExtension() {
    return {
      js: '.js'
    };
  }
});
