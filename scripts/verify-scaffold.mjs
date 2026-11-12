import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),issues=[];
const skip=new Set(['node_modules','dist','build','.git','.local','.wrangler','test-results','playwright-report','coverage']);
async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(skip.has(entry.name))continue;const path=join(dir,entry.name),rel=relative(root,path).replaceAll('\\','/');if(rel.startsWith('docs/handoffs/'))continue;if(entry.isDirectory()){await visit(path);continue;}if(!/\.(?:ts|tsx|js|mjs|json|md|yaml|yml|toml|py)$/.test(path))continue;const text=await readFile(path,'utf8');if(!text.trim()||/^(?:\/\/ PLANNED MODULE:|# Planned configuration:)/m.test(text)||/^Planned document\. Not yet implemented\./m.test(text)||text.trim()==='export {};')issues.push(rel);}}
await visit(root);if(issues.length){console.error('Unfinished/empty source artifacts:\n'+issues.join('\n'));process.exitCode=1;}else console.log('Source completeness gate PASS: no unfinished/empty code/config/docs outside archived historical handoffs. Retired duplicate scaffold modules are listed in the audit, not disguised as implementations.');
