import { defineConfig } from 'vite';
export default defineConfig({server:{allowedHosts:['terminal.local'],proxy:{'/api':{target:'http://127.0.0.1:8000',ws:true}}},preview:{proxy:{'/api':{target:'http://127.0.0.1:8000',ws:true}}}});
