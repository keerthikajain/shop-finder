import { defineConfig } from 'vite';
export default defineConfig({server:{allowedHosts:['terminal.local'],proxy:{'/api':'http://127.0.0.1:8000'}},preview:{proxy:{'/api':'http://127.0.0.1:8000'}}});
