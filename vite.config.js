import { defineConfig } from 'vite';
import { resolveBase } from './src/base.js';
export default defineConfig({ base: resolveBase(process.env), build: { target: 'es2022' } });
