import config from '../vite.config';import {defineConfig} from 'vite';
/** Local fixture mirrors Build's edition contract without changing release defaults. */
export default defineConfig(env=>{const base=typeof config==='function'?config(env):config;return {...base,define:{...base.define,__PUNCHIES_EDITION__:JSON.stringify('crazygames'),__PUNCHIES_EDITION_FIGHTERS__:JSON.stringify(['marco','mia','bruno','roxy','nadia','tee','tyke','dragon','longan','captain','kai'])}};});
