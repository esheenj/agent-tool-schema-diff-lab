import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCatalogs,parseCatalog} from '../src/diff.mjs';

const tool=(schema,name='query')=>[{name,inputSchema:schema}];
const obj=(props={},required=[])=>({type:'object',properties:props,required});
const compare=(a,b)=>compareCatalogs(tool(a),tool(b));

test('accepts MCP, Anthropic, and OpenAI function wrappers',()=>{
 assert.equal(parseCatalog({tools:[{type:'function',function:{name:'a',parameters:obj()}}]}).size,1);
 assert.equal(parseCatalog([{name:'a',input_schema:obj()}]).size,1);
 assert.equal(parseCatalog([{name:'a',inputSchema:obj()}]).size,1);
});
test('empty tools are compatible',()=>assert.equal(compareCatalogs([],[]).status,'compatible'));
test('schema key-order changes do not signal differences',()=>{
 assert.equal(compare({type:'object',properties:{a:{type:'string'}}},{properties:{a:{type:'string'}},type:'object'}).changes.length,0);
});
test('removed tool is breaking',()=>assert.equal(compareCatalogs(tool(obj()),[]).status,'breaking'));
test('added tool is compatible',()=>assert.equal(compareCatalogs([],tool(obj())).status,'compatible'));
test('duplicate tool names fail closed',()=>assert.throws(()=>parseCatalog([...tool(obj()),...tool(obj())]),/Duplicate/));
test('new required field is breaking',()=>assert.equal(compare(obj({q:{type:'string'}}),obj({q:{type:'string'}},['q'])).status,'breaking'));
test('removed required field is compatible',()=>assert.equal(compare(obj({q:{type:'string'}},['q']),obj({q:{type:'string'}})).status,'compatible'));
test('removed declared property is breaking',()=>assert.equal(compare(obj({q:{type:'string'}}),obj()).status,'breaking'));
test('added optional property is compatible',()=>assert.equal(compare(obj(),obj({q:{type:'string'}})).status,'compatible'));
test('enum narrowed is breaking',()=>assert.equal(compare(obj({q:{enum:['a','b']}}),obj({q:{enum:['a']}})).status,'breaking'));
test('enum widened is compatible',()=>assert.equal(compare(obj({q:{enum:['a']}}),obj({q:{enum:['a','b']}})).status,'compatible'));
test('narrowed types are breaking',()=>assert.equal(compare(obj({q:{type:['string','null']}}),obj({q:{type:'string'}})).status,'breaking'));
test('tightening range is breaking, relaxing is compatible',()=>{
 assert.equal(compare(obj({q:{minimum:1,maximum:100}}),obj({q:{minimum:2,maximum:50}})).status,'breaking');
 assert.equal(compare(obj({q:{minimum:2,maximum:50}}),obj({q:{minimum:1,maximum:100}})).status,'compatible');
});
test('disallowing extra keys is breaking',()=>assert.equal(compare({...obj(),additionalProperties:true},{...obj(),additionalProperties:false}).status,'breaking'));
test('nested item types detect breaking changes',()=>assert.equal(compare(obj({q:{type:'array',items:{type:'string'}}}),obj({q:{type:'array',items:{type:'integer'}}})).status,'breaking'));
test('changed $ref gets manual review instead of false safety',()=>{
 const a=compare(obj({q:{$ref:'#/$defs/a'}}),obj({q:{$ref:'#/$defs/b'}}));
 assert.equal(a.status,'review');
});
test('unchanged complex schema is compatible without claiming full validation',()=>{
 assert.equal(compare(obj({q:{$ref:'#/defs/a'}}),obj({q:{$ref:'#/defs/a'}})).status,'compatible');
});
test('tool descriptions are informational',()=>assert.equal(compareCatalogs([{name:'a',description:'one'}],[{name:'a',description:'two'}]).status,'compatible'));
test('invalid catalog and invalid schema fail closed',()=>{
 assert.throws(()=>parseCatalog({tools:'bad'}),/tools array/);
 assert.throws(()=>parseCatalog([{name:'abc',inputSchema:'bad'}]),/Invalid input/);
});
test('result reports all severity counters',()=>{
 const out=compare(obj({x:{type:'string'}}),obj({x:{type:'number'},y:{type:'string'}}));
 assert.equal(out.summary.breaking,1);
 assert.equal(out.summary.info,2);
 assert.equal(out.status,'breaking');
});
