import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createBackup,parseBackup,type Exercise} from '../src/backup';

const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const code=ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n))
  .map(n=>n.getText(ast).replace(/^export /,'')).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
type Node={type:unknown;props:Record<string,any>};
const base:Exercise={id:'unassigned',raw:'Walk',title:'Walk',split:null,routine:null,priority:null,meta:null,completed:false,createdAt:'2026-10-21T00:00:00Z'};
const records=parseBackup(createBackup([base,{...base,id:'legs',title:'Squat',split:'legs'},{...base,id:'push',title:'Press',split:'push',completed:true}])).exercises;
function page(tab:string,items=records,day='2026-10-21T12:00:00Z',conflict=false){
  let state=0;const tabs:string[]=[];
  const useState=(initial:unknown)=>{const i=state++;return [i===0?items:i===2?tab:i===5?true:i===7?conflict:initial,(value:unknown)=>{if(i===2)tabs.push(String(value));}];};
  const React={createElement(type:unknown,props:unknown,...children:unknown[]):Node{return {type,props:{...(props??{}),children:children.flat()}};}};
  const DatePort=class extends Date{constructor(){super(day);}};
  const App=new Function('React','useState','useCallback','useEffect','useMemo','useRef','Date',code+'\nreturn App;')(React,useState,(f:unknown)=>f,()=>{},(f:()=>unknown)=>f(),(x:unknown)=>({current:x}),DatePort);
  const tree=App(),nodes:Node[]=[];
  function walk(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}const n=value as Node;nodes.push(n);walk(n.props?.children);}
  walk(tree);return {nodes,tabs};
}
function text(n:Node):string{return (n.props.children??[]).map((v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):v&&typeof v==='object'?text(v as Node):'').join('');}
test('All Exercises navigation is available from the default workout view',()=>{
  const p=page('today'),button=p.nodes.find(n=>n.type==='button'&&text(n)==='All Exercises');
  expect(button).toBeDefined();button!.props.onClick();expect(p.tabs).toEqual(['all']);
});
for(const day of ['2026-10-21T12:00:00Z','2026-10-25T12:00:00Z'])test('All Exercises exposes null and every assigned split on '+day,()=>{
  const p=page('all',records,day),rows=p.nodes.filter(n=>n.props['data-remove-id']!==undefined);
  expect(rows.map(n=>n.props['data-remove-id'])).toEqual(['unassigned','legs','push']);
  expect(p.nodes.filter(n=>n.type==='button'&&typeof n.props['aria-pressed']==='boolean'&&String(n.props['aria-label']??'').startsWith('Completed:')).map(n=>n.props['aria-pressed'])).toEqual([false,false,true]);
  expect(p.nodes.some(n=>n.type==='h2'&&text(n)==='All Exercises'&&n.props.tabIndex===-1)).toBe(true);
});
test('All Exercises renders an accessible empty state',()=>{const p=page('all',[]);expect(p.nodes.some(n=>text(n)==='No exercises yet.')).toBe(true);expect(p.nodes.some(n=>n.props['data-remove-id']!==undefined)).toBe(false);});
test('All Exercises retains storage-conflict action disabling',()=>{
  const p=page('all',records,undefined,true),actions=p.nodes.filter(n=>n.props['data-remove-id']!==undefined||String(n.props['aria-label']??'').startsWith('Completed:'));
  expect(actions).toHaveLength(6);for(const n of actions)expect(n.props.disabled).toBe(true);
});

const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='App')as ts.FunctionDeclaration;
const remove=component.body!.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(n=>n.name.getText(ast)==='remove')!;
const removeCode=ts.transpileModule('const '+remove.getText(ast)+';return remove;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for(const id of ['unassigned','legs'])test('all-record removal focus follows displayed order for '+id,async()=>{
  const saves:Exercise[][]=[],pendingFocus={current:null as unknown};
  const fn=new Function('exercises','tab','pendingFocus','persist','announce','useCallback',removeCode)(records,'all',pendingFocus,async(next:Exercise[])=>{saves.push(next);return true;},()=>{},(f:unknown)=>f);
  await fn(id);expect(saves[0].map(x=>x.id)).toEqual(records.filter(x=>x.id!==id).map(x=>x.id));expect(pendingFocus.current).toEqual({id:id==='unassigned'?'legs':'push'});
});
test('scheduled workout removal preserves its existing same-split neighbour rule',async()=>{
  const repeated=[records[1],{...records[1],id:'legs-2'},records[2]],pendingFocus={current:null as unknown};
  const fn=new Function('exercises','tab','pendingFocus','persist','announce','useCallback',removeCode)(repeated,'today',pendingFocus,async()=>true,()=>{},(f:unknown)=>f);await fn('legs');expect(pendingFocus.current).toEqual({id:'legs-2'});
});
