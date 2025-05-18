import { defineConfig } from 'tsup'

export default defineConfig({    entry: ['src/index.ts'],
    outDir: 'dist',
    sourcemap: true,
    clean: true,
    format: ['esm'],
    platform: 'node',
    target: 'node18',    bundle: true,
    splitting: false,
    dts: true,
    external: [
        '@elizaos/core',
        'fs',
        'path',
        'docx'
    ]
})
