require('esbuild')
  .context({
    entryPoints: {
      client: './src/extension.ts',
      server: '../language-server/src/index.ts',
    },
    sourcemap: true,
    bundle: true,
    outdir: './dist',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    define: { 'process.env.NODE_ENV': '"production"' },
    minify: process.argv.includes('--minify'),
  })
  .then(async (ctx) => {
    console.log('building...')
    if (process.argv.includes('--watch')) {
      await ctx.watch()
      console.log('watching...')
    } else {
      await ctx.rebuild()
      await ctx.dispose()
      console.log('finished.')
    }
  })
