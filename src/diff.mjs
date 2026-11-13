// Offline, dependency-free tool-contract compatibility analysis.
// Bounded, conservative checks; not a complete JSON Schema validator.
const complexKeywords = new Set([
  '$ref', '$defs', 'definitions', 'oneOf', 'anyOf', 'allOf', 'not',
  'if', 'then', 'else', 'patternProperties', 'dependentRequired',
  'dependentSchemas', 'unevaluatedProperties', 'contains', 'prefixItems',
  'propertyNames', 'discriminator'
]);
const knownKeywords = new Set([
  'type', 'properties', 'required', 'items', 'enum', 'const',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
  'additionalProperties', 'description', 'title', 'default',
  'examples', 'deprecated', '$schema', '$id', 'readOnly', 'writeOnly'
]);

export function parseCatalog(input) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  const tools = Array.isArray(parsed) ? parsed : parsed && parsed.tools;
  if (!Array.isArray(tools)) throw new Error('Expected a JSON tool array or an object with a tools array.');
  if (tools.length > 500) throw new Error('Limit exceeded: at most 500 tools per catalog.');
  const out = new Map();
  for (const tool of tools) {
    const item = tool && tool.type === 'function' && tool.function ? tool.function : tool;
    if (!item || typeof item.name !== 'string' || !/^[\w.:\-/]{1,128}$/.test(item.name)) {
      throw new Error('Each tool needs a valid name (letters, numbers, _, -, ., :, /).');
    }
    if (out.has(item.name)) throw new Error('Duplicate tool name: ' + item.name);
    const schema = item.inputSchema ?? item.input_schema ?? item.parameters ?? {type:'object',properties:{}};
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new Error('Invalid input schema for ' + item.name);
    }
    out.set(item.name, {schema, description: typeof item.description === 'string' ? item.description : ''});
  }
  return out;
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function allowedTypes(schema) {
  if (!Object.hasOwn(schema,'type')) return null;
  const all = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!all.length || all.some(t => typeof t !== 'string')) return null;
  return new Set(all);
}

export function compareCatalogs(oldCatalog, newCatalog) {
  const before = parseCatalog(oldCatalog), after = parseCatalog(newCatalog);
  const changes=[];
  const add=(severity, path, message)=>changes.push({severity,path,message});
  const seen = new Set();
  const inspect = (oldS,newS,path,depth) => {
    if (depth > 20) { add('review',path,'Schema nesting exceeds the comparison limit.'); return; }
    if (canonical(oldS) === canonical(newS)) return;

    for (const [label,s] of [['previous',oldS],['current',newS]]) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        add('review',path,label+' schema is not a supported object.'); return;
      }
      const unknown = Object.keys(s).filter(k=>complexKeywords.has(k)||!knownKeywords.has(k));
      if (unknown.length) add('review',path,label+' schema uses keywords needing manual review: '+unknown.join(', '));
    }

    const oldT=allowedTypes(oldS), newT=allowedTypes(newS);
    if (oldT && newT) {
      for (const t of oldT) if (!newT.has(t)) add('breaking',path,'Previously accepted type removed: '+t);
      for (const t of newT) if (!oldT.has(t)) add('info',path,'Accepted type added: '+t);
    } else if (!oldT && newT) add('breaking',path,'Type restriction introduced.');
    else if (oldT && !newT) add('info',path,'Type restriction removed.');

    if (Object.hasOwn(newS,'const') && canonical(newS.const)!==canonical(oldS.const)) {
      add('breaking',path,'Constant input value introduced or changed.');
    } else if (Object.hasOwn(oldS,'const')&&!Object.hasOwn(newS,'const')) add('info',path,'Constant input restriction removed.');

    const oldE=Array.isArray(oldS.enum)?oldS.enum:null, newE=Array.isArray(newS.enum)?newS.enum:null;
    if (newE) {
      if (!oldE) add('breaking',path,'Allowed-value enum restriction introduced.');
      else {
        for(const v of oldE) if(!newE.some(n=>canonical(n)===canonical(v))) add('breaking',path,'Previously accepted enum value removed: '+JSON.stringify(v));
        for(const v of newE) if(!oldE.some(n=>canonical(n)===canonical(v))) add('info',path,'Accepted enum value added: '+JSON.stringify(v));
      }
    } else if(oldE) add('info',path,'Enum restriction removed.');

    for (const [key,tightens] of [
      ['minimum',(a,b)=>b>a],['exclusiveMinimum',(a,b)=>b>a],
      ['maximum',(a,b)=>b<a],['exclusiveMaximum',(a,b)=>b<a],
      ['minLength',(a,b)=>b>a],['maxLength',(a,b)=>b<a],
      ['minItems',(a,b)=>b>a],['maxItems',(a,b)=>b<a]
    ]) {
      const oldV=oldS[key], newV=newS[key];
      if (oldV===undefined&&newV!==undefined) add('breaking',path,key+' restriction introduced: '+newV);
      else if(oldV!==undefined&&newV===undefined) add('info',path,key+' restriction removed.');
      else if(typeof oldV==='number'&&typeof newV==='number'&&oldV!==newV)
        add(tightens(oldV,newV)?'breaking':'info',path,key+' changed from '+oldV+' to '+newV);
      else if(oldV!==undefined&&newV!==undefined&&oldV!==newV)
        add('review',path,key+' changed using unsupported value types.');
    }

    const oldReq=new Set(Array.isArray(oldS.required)?oldS.required:[]);
    const newReq=new Set(Array.isArray(newS.required)?newS.required:[]);
    for(const r of newReq) if(!oldReq.has(r)) add('breaking',path+'.'+r,'New required field.');
    for(const r of oldReq) if(!newReq.has(r)) add('info',path+'.'+r,'Field no longer required.');

    const oldP=oldS.properties&&typeof oldS.properties==='object'&&!Array.isArray(oldS.properties)?oldS.properties:{};
    const newP=newS.properties&&typeof newS.properties==='object'&&!Array.isArray(newS.properties)?newS.properties:{};
    for(const name of Object.keys(oldP)) {
      const child=path+'.'+name;
      if(!Object.hasOwn(newP,name)) add('breaking',child,'Declared field removed from tool contract.');
      else inspect(oldP[name],newP[name],child,depth+1);
    }
    for(const name of Object.keys(newP)) if(!Object.hasOwn(oldP,name))
      add(newReq.has(name)?'breaking':'info',path+'.'+name,'Declared '+(newReq.has(name)?'required':'optional')+' field added.');

    const oldAP=oldS.additionalProperties, newAP=newS.additionalProperties;
    if(newAP===false&&oldAP!==false) add('breaking',path,'Additional properties were disallowed.');
    else if(oldAP===false&&newAP!==false) add('info',path,'Additional properties are now allowed or schema-based.');
    if ((newAP&&typeof newAP==='object')||(oldAP&&typeof oldAP==='object'))
      if(canonical(oldAP)!==canonical(newAP)) add('review',path,'Schema-based additionalProperties needs manual review.');

    if(oldS.items||newS.items) {
      if(oldS.items&&newS.items) inspect(oldS.items,newS.items,path+'[]',depth+1);
      else if(!oldS.items) add('review',path,'Array item restrictions introduced; review compatibility.');
      else add('info',path,'Array item restrictions removed.');
    }

    if(oldS.description!==newS.description) add('info',path,'Description changed.');
  };
  for (const [name, oldValue] of before) {
    seen.add(name);
    if(!after.has(name)) add('breaking',name,'Tool removed.');
    else {
      const current=after.get(name);
      inspect(oldValue.schema,current.schema,name+'.input',0);
      if(oldValue.description!==current.description) add('info',name,'Tool description changed.');
    }
  }
  for(const name of after.keys()) if(!seen.has(name)) add('info',name,'Tool added.');
  const order={breaking:0,review:1,info:2};
  changes.sort((a,b)=>(order[a.severity]-order[b.severity])||a.path.localeCompare(b.path)||a.message.localeCompare(b.message));
  const summary={breaking:0,review:0,info:0};
  for(const c of changes) summary[c.severity]++;
  return {status:summary.breaking?'breaking':summary.review?'review':'compatible',summary,oldTools:before.size,newTools:after.size,changes,limitations:'Conservative subset of JSON Schema; review $ref, combinators, nonstandard keywords, and semantic behavior manually.'};
}
