import config from '../vite.config';
import {defineConfig} from 'vite';
import path from 'node:path';
export default defineConfig(env=>{const base=typeof config==='function'?config(env):config;return {...base,build:{...base.build,outDir:path.resolve('outputs/modern-ui-review-build'),rollupOptions:{input:path.resolve('tools/modern-ui-review.html')}}};});
