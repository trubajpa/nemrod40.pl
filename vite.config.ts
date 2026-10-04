import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

const buildRevision = (process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  define: { 'import.meta.env.VITE_BUILD_REVISION': JSON.stringify(buildRevision) },
})
