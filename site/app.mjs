import {compareCatalogs} from './diff.mjs';
const $=id=>document.getElementById(id);
let last=null;
const exampleBefore={
 tools:[
 {name:'search_documents',inputSchema:{type:'object',properties:{query:{type:'string',minLength:1},limit:{type:'integer',maximum:100},category:{type:'string',enum:['manual','guide','faq']}},required:['query'],additionalProperties:false}},
 {name:'summarize',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text']}}
 ]};
const exampleAfter={
 tools:[
 {name:'search_documents',inputSchema:{type:'object',properties:{query:{type:'string',minLength:3},limit:{type:'integer',maximum:50},category:{type:'string',enum:['manual','faq']},region:{type:'string'}},required:['query','region'],additionalProperties:false}},
 {name:'summarize',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text']}},
 {name:'get_status',inputSchema:{type:'object',properties:{}}}
 ]};

function loadExamples(){
 $('before').value=JSON.stringify(exampleBefore,null,2);
 $('after').value=JSON.stringify(exampleAfter,null,2);
 $('summary').textContent='Example loaded. Compare to inspect breaking changes.';
}
function compare(){
 try{
   const before=$('before').value,after=$('after').value;
   if(!before||!after)throw new Error('Paste both catalogs or select Load example.');
   if(before.length>1048576||after.length>1048576)throw new Error('Each input must be at most 1 MiB.');
   const result=compareCatalogs(before,after);
   last=result;
   for(const key of ['breaking','review','info'])$(key).textContent=String(result.summary[key]);
   $('state').textContent=result.status.toUpperCase();
   $('state').className='state '+result.status;
   $('summary').textContent='Compared '+result.oldTools+' previous tools with '+result.newTools+' current tools. '+result.limitations;
   const list=$('changes');list.replaceChildren();
   if(!result.changes.length){
     const li=document.createElement('li');li.textContent='No contract differences detected within the supported subset.';list.append(li);
   }else for(const change of result.changes){
     const li=document.createElement('li');
     const label=document.createElement('span');label.className='severity '+change.severity;label.textContent=change.severity.toUpperCase();
     const body=document.createElement('div');const head=document.createElement('strong');head.textContent=change.path;
     const message=document.createElement('p');message.textContent=change.message;body.append(head,message);li.append(label,body);list.append(li);
   }
   $('download').disabled=false;
 }catch(error){
   last=null;$('download').disabled=true;
   for(const key of ['breaking','review','info'])$(key).textContent='—';
   $('state').textContent='INPUT ERROR';$('state').className='state breaking';
   $('summary').textContent=error.message;$('changes').replaceChildren();
 }
}
function download(){
 if(!last)return;
 const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');
 a.href=url;a.download='agent-tool-schema-diff.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('load').addEventListener('click',loadExamples);
$('compare').addEventListener('click',compare);
$('download').addEventListener('click',download);
loadExamples();
