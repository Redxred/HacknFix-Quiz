const path=require('node:path');
const esbuild=require('esbuild');
const root=path.join(__dirname,'..');
esbuild.buildSync({
  entryPoints:[path.join(root,'portal-three.js')],
  outfile:path.join(root,'vendor','portal-three.min.js'),
  bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'none',
  banner:{js:'/*! Three.js copyright (c) 2010-2026 three.js authors. MIT license: /vendor/THREE-LICENSE.txt */'},
});
