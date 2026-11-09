// Re-encode the original product photographs without altering their content.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('C:/Users/siste/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const assetDir = path.resolve(__dirname, '../assets');
(async () => {
 const names = ['lost-cherry','rose-prick','tobacco-vanille','neroli-portofino','oud-wood','dark-marble'];
 const sizes = await Promise.all(names.map(async name => {
  const input = path.join(assetDir, name+'.png');
  const output = path.join(assetDir, name+'.webp');
  await sharp(input).resize({width:name==='dark-marble'?1536:768, withoutEnlargement:true}).webp({quality:85,alphaQuality:100,effort:6}).toFile(output);
  return {name, before:(await fs.stat(input)).size, after:(await fs.stat(output)).size};
 }));
 console.log(JSON.stringify(sizes, null, 2));
})();
