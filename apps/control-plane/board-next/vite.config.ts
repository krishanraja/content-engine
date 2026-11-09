// The live board's client (docs/plans/2026-11-09-board-desk/PLAN.md, build round 3). One self-contained HTML file:
// scripts/build-desk-page.mjs builds it and writes it into api/board/_deskPage.ts, which the board serves.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: 'es2022' },
  logLevel: 'warn',
})
