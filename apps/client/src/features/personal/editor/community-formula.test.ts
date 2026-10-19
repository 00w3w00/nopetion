import { describe, expect, it } from "vitest";
import { evaluateCommunityFormula as evaluate, PersonalDatabase, PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell } from "@docmost/editor-ext";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
describe("Independent community database",()=>{
  it("evaluates arithmetic, named values, strings and aggregation",()=>{
    expect(evaluate('prop("가격") * 2 + 3',()=>4500)).toBe(9003);
    expect(evaluate('concat(upper("hello"), " ", format(round(2.6)))',()=>null)).toBe("HELLO 3");
    expect(evaluate('average(prop("values"))',()=>[4,6,null])).toBe(5);
    expect(evaluate('count(prop("values"))',()=>["a","",null,"b"])).toBe(2);
  });
  it("short circuits inactive expressions",()=>{
    expect(evaluate('if(true, 10, 1 / 0)',()=>null)).toBe(10);
    expect(evaluate('false && prop("private")',()=>{throw Error('Must not read');})).toBe(false);
  });
  it("rejects executable code, non-finite values and resource exhaustion",()=>{
    for(const formula of ['process.exit()','globalThis.fetch("https://example.com")','constructor("return process")()','1 / 0','1e999','prop("x")[0]','Math.random()','"a".repeat(99)'])expect(()=>evaluate(formula,()=>1)).toThrow();
    expect(()=>evaluate('('.repeat(40)+'1'+')'.repeat(40),()=>null)).toThrow();
    expect(()=>evaluate('1+'.repeat(200)+'1',()=>null)).toThrow();
  });
  it("preserves independent custom cells during concurrent Yjs edits and HTML import",()=>{
    const a=new Y.Doc(),b=new Y.Doc();
    const extensions=[StarterKit.configure({undoRedo:false,trailingNode:false}),PersonalDatabase,PersonalDatabaseRow,PersonalDatabaseProperty,PersonalDatabaseCell];
    const first=new Editor({extensions:[...extensions,Collaboration.configure({document:a})]});
    first.commands.setContent({type:'doc',content:[{type:'personalDatabase',attrs:{id:'db'},content:[{type:'personalDatabaseProperty',attrs:{id:'p1',name:'사용자 속성'}},{type:'personalDatabaseRow',attrs:{id:'row',title:'원본'},content:[{type:'personalDatabaseCell',attrs:{id:'c1',propertyId:'p1',value:'이전'}},{type:'personalDatabaseCell',attrs:{id:'c2',propertyId:'p2',value:1}}]}]},{type:'paragraph',content:[{type:'text',text:'보존할 본문'}]}]});
    Y.applyUpdate(b,Y.encodeStateAsUpdate(a));
    const second=new Editor({extensions:[...extensions,Collaboration.configure({document:b})]});
    first.commands.command(({tr})=>{tr.setNodeAttribute(3,'value','한국어');return true;});
    second.commands.command(({tr})=>{tr.setNodeAttribute(4,'value',42);return true;});
    const ua=Y.encodeStateAsUpdate(a),ub=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,ub);Y.applyUpdate(b,ua);
    expect(first.getJSON()).toEqual(second.getJSON());expect(first.state.doc.nodeAt(3).attrs.value).toBe('한국어');expect(first.state.doc.nodeAt(4).attrs.value).toBe(42);
    const html=first.getHTML(),restored=new Editor({extensions,content:html});
    expect(restored.getJSON()).toEqual(first.getJSON());expect(restored.getText()).toContain('보존할 본문');
    first.destroy();second.destroy();restored.destroy();a.destroy();b.destroy();
  });
});
