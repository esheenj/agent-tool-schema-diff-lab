#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {compareCatalogs} from './diff.mjs';

const [before,after]=process.argv.slice(2);
if(!before||!after){
  console.error('Usage: node src/cli.mjs previous-tools.json current-tools.json');
  process.exit(1);
}
try{
  const a=await readFile(before,'utf8'),b=await readFile(after,'utf8');
  if(a.length>1048576||b.length>1048576) throw new Error('Each file must be at most 1 MiB.');
  const result=compareCatalogs(a,b);
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.status==='breaking'?2:result.status==='review'?3:0;
}catch(error){
  console.error('Input error: '+error.message);
  process.exitCode=1;
}
