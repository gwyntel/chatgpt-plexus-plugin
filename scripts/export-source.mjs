import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=process.argv[2];
if(!out)throw Error('Usage: node scripts/export-source.mjs /absolute/new/output');
const path=resolve(out);if(!out.startsWith('/')||path===process.cwd()||path.startsWith(process.cwd()+'/'))throw Error('Choose a separate absolute output directory.');
await mkdir(path,{recursive:false});
for(const item of ['README.md','package.json','worker','scripts','.gitignore','.env.example','skills','plugin','plugin-connect','.github','LICENSE'])await cp(item,resolve(path,item),{recursive:true});
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));delete manifest.project_id;
await mkdir(resolve(path,'.openai'));await writeFile(resolve(path,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Exported source without deployment identity or Git history: '+path);

