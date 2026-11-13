import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{force:true,recursive:true});
await mkdir('dist',{recursive:true});
for(const filename of ['index.html','app.mjs','style.css']) await copyFile('site/'+filename,'dist/'+filename);
await copyFile('src/diff.mjs','dist/diff.mjs');
console.log('Built offline static site at dist/');
