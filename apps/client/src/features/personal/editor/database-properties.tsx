import { useEffect, useState } from "react";
import { Button, Group, Modal, Select, Stack, TextInput, Textarea, MultiSelect, Text } from "@mantine/core";
import { useQueries } from "@tanstack/react-query";
import type { NodeViewProps } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { useTranslation } from "react-i18next";
import { COMMUNITY_PROPERTY_TYPES, evaluateCommunityFormula, type FormulaValue } from "@docmost/editor-ext";
import { getPageById } from "@/features/page/services/page-service";
import { searchSuggestions } from "@/features/search/services/search-service";
import { selectedPersonalWorkspace } from "@/lib/personal-workspace-scope";

type Definition = {id:string;name:string;kind:string;options:string;formula:string;targetPageId:string;targetDatabaseId:string;relationId:string;sourceProperty:string;aggregation:string;deleted:boolean};
const labels:Record<string,string> = {text:"Text",number:"Number",checkbox:"Checkbox",date:"Date",select:"Select",multi_select:"Multi-select",url:"URL",email:"Email",phone:"Phone",relation:"Relation",formula:"Formula",rollup:"Rollup"};
const builtin:Record<string,string> = {Name:"title",Status:"status",Assignee:"assignee",Date:"date",Value:"number",Location:"location",이름:"title",상태:"status",담당자:"assignee",날짜:"date",값:"number",위치:"location"};
export function databaseNodes(content:any):any[] {
  if (!content || typeof content !== "object") return [];
  if(content.type==="personalDatabase")return [content];
  return Array.isArray(content.content)?content.content.flatMap(databaseNodes):[];
}
export function useDatabaseProperties({node,editor,getPos}:Pick<NodeViewProps,"node"|"editor"|"getPos">) {
  const {t}=useTranslation();
  const [editing,setEditing]=useState<Definition|null>(null);
  const [error,setError]=useState("");
  const definitions:Definition[]=[];
  const rowNodes=new Map<string,PMNode>();
  node.forEach(child=>{if(child.type.name==="personalDatabaseProperty" && !child.attrs.deleted)definitions.push(child.attrs as Definition);if(child.type.name==="personalDatabaseRow")rowNodes.set(child.attrs.id,child);});
  const targets=[...new Set(definitions.filter(d=>d.kind==="relation" && d.targetPageId).map(d=>d.targetPageId))];
  const queries=useQueries({queries:targets.map(pageId=>({queryKey:["community-relation",selectedPersonalWorkspace(),pageId],queryFn:()=>getPageById({pageId}),staleTime:0,refetchInterval:10000,retry:false}))});
  const targetPage=(id:string)=>queries[targets.indexOf(id)];
  const relationRows=(definition:Definition) => {
    const result=targetPage(definition.targetPageId);
    if(result?.isError || result?.isLoading)return [];
    const databases=databaseNodes(result?.data?.content);
    const database=databases.find(d=>d.attrs?.id===definition.targetDatabaseId);
    return (database?.content||[]).filter(r=>r.type==="personalDatabaseRow" && !r.attrs?.deleted);
  };
  const liveDatabase=()=>{const pos=getPos();const live=typeof pos==="number" && editor.state.doc.nodeAt(pos);return live?.type.name==="personalDatabase"?{pos,node:live}:null;};
  const setCell=(rowId:string,propertyId:string,value:FormulaValue)=>{
    if(!editor.isEditable || editor.isDestroyed)return;
    const live=liveDatabase();if(!live)return;
    let rowPos:number|undefined,cellPos:number|undefined,row:PMNode;
    live.node.forEach((child,offset)=>{if(child.type.name==="personalDatabaseRow" && child.attrs.id===rowId){row=child;rowPos=live.pos+1+offset;child.forEach((cell,cellOffset)=>{if(cell.attrs.propertyId===propertyId && cellPos===undefined)cellPos=rowPos+1+cellOffset;});}});
    if(rowPos===undefined || cellPos!==undefined && JSON.stringify(editor.state.doc.nodeAt(cellPos)?.attrs.value)===JSON.stringify(value))return;
    editor.commands.command(({tr})=>{
      if(cellPos!==undefined)tr.setNodeAttribute(cellPos,"value",value);
      else tr.insert(rowPos+row.nodeSize-1,editor.schema.nodes.personalDatabaseCell.create({id:crypto.randomUUID(),propertyId,value}));
      return true;
    });
  };
  const rawCell=(rowId:string,propertyId:string):FormulaValue=>{let value:FormulaValue=null;rowNodes.get(rowId)?.forEach(cell=>{if(cell.attrs.propertyId===propertyId && value===null)value=cell.attrs.value;});return value;};
  const resolve=(rowId:string,name:string,seen=new Set<string>()):FormulaValue=>{
    const row=rowNodes.get(rowId);if(!row)return null;
    const key=(Object.prototype.hasOwnProperty.call(builtin,name)?builtin[name]:null) || (Object.values(builtin).includes(name)?name:null);
    if(key)return row.attrs[key] as FormulaValue;
    const def=definitions.find(d=>d.id===name || d.name===name);
    if(!def)throw Error(t("Unknown property"));
    if(seen.has(def.id)||seen.size>16)throw Error(t("Circular formula"));
    const next=new Set(seen).add(def.id);
    if(def.kind==="formula")return evaluateCommunityFormula(def.formula,property=>resolve(rowId,property,next));
    if(def.kind==="rollup"){
      const relation=definitions.find(d=>d.id===def.relationId && d.kind==="relation");
      if(!relation)throw Error(t("Choose a relation property"));
      const query=targetPage(relation.targetPageId);
      if(query?.isError)throw Error(t("Source is unavailable"));
      if(query?.isLoading)throw Error(t("Loading"));
      const selected=rawCell(rowId,relation.id);
      const records=relationRows(relation).filter(r=>Array.isArray(selected)&&selected.includes(r.attrs.id));
      const values=records.map(r=>{
        const sourceKey=Object.prototype.hasOwnProperty.call(builtin,def.sourceProperty)?builtin[def.sourceProperty]:def.sourceProperty;
        if(Object.prototype.hasOwnProperty.call(r.attrs,sourceKey))return r.attrs[sourceKey];
        const target=databaseNodes(query?.data?.content).find(d=>d.attrs?.id===relation.targetDatabaseId);
        const property=target?.content?.find(p=>p.type==="personalDatabaseProperty" && !p.attrs.deleted && (p.attrs.id===sourceKey || p.attrs.name===sourceKey));
        if(property && ["formula","rollup"].includes(property.attrs.kind))throw Error(t("Rollup source must be a stored property"));
        return r.content?.find(c=>c.type==="personalDatabaseCell" && c.attrs.propertyId===(property?.attrs.id||sourceKey))?.attrs.value??null;
      });
      if(!["sum","count","average","min","max"].includes(def.aggregation))throw Error(t("Invalid aggregation"));
      return evaluateCommunityFormula(`${def.aggregation}(prop("values"))`,()=>values);
    }
    return rawCell(rowId,def.id);
  };
  const renderCell=(rowId:string,def:Definition)=>{
    const readOnly=!editor.isEditable;
    const value=rawCell(rowId,def.id);
    if(["formula","rollup"].includes(def.kind)){
      try {const computed=resolve(rowId,def.id);return <output data-property-result={def.id}>{String(computed??"")}</output>;}
      catch(e){return <Text c="red" size="xs" title={e.message}>{t("Formula error")}: {e.message}</Text>;}
    }
    const options=[...new Set(def.options.split(",").map(s=>s.trim()).filter(Boolean))].slice(0,100);
    if(def.kind==="relation"){
      const query=targetPage(def.targetPageId);
      if(query?.isError)return <Text size="xs" c="dimmed">{t("Source is unavailable")}</Text>;
      return <MultiSelect size="xs" aria-label={def.name} searchable disabled={readOnly||query?.isLoading||!def.targetDatabaseId}
        data={relationRows(def).map(r=>({value:r.attrs.id,label:r.attrs.title||t("Untitled")}))}
        value={Array.isArray(value)?value.filter(v=>typeof v==="string") as string[]:[]} onChange={ids=>setCell(rowId,def.id,ids)} />;
    }
    if(def.kind==="multi_select")return <MultiSelect size="xs" aria-label={def.name} disabled={readOnly} data={options} value={Array.isArray(value)?value as string[]:[]} onChange={v=>setCell(rowId,def.id,v)} />;
    if(def.kind==="select")return <Select size="xs" aria-label={def.name} disabled={readOnly} clearable data={options} value={typeof value==="string"?value:null} onChange={v=>setCell(rowId,def.id,v)} />;
    if(def.kind==="checkbox")return <input type="checkbox" aria-label={def.name} disabled={readOnly} checked={value===true} onChange={e=>setCell(rowId,def.id,e.currentTarget.checked)}/>;
    const inputType=({number:"number",date:"date",url:"url",email:"email",phone:"tel"})[def.kind]||"text";
    return <input key={String(value??"")} aria-label={def.name} type={inputType} maxLength={4000} defaultValue={String(value??"")} readOnly={readOnly}
      onBlur={e=>{const v=e.currentTarget.value;if(inputType==="number" && v && !Number.isFinite(Number(v)))return;setCell(rowId,def.id,inputType==="number"?v?Number(v):null:v);}}/>;
  };
  const saveDefinition=(deleted=false)=>{
    if(!editing || !editor.isEditable)return;
    if(!editing.name.trim()){setError(t("Enter a property name"));return;}
    if(definitions.some(d=>d.name===editing.name && d.id!==editing.id)){setError(t("Property name already exists"));return;}
    if(editing.kind==="formula"){try{evaluateCommunityFormula(editing.formula,()=>1);}catch(e){setError(e.message);return;}}
    const live=liveDatabase();if(!live)return;
    let found:number|undefined;live.node.forEach((child,offset)=>{if(child.type.name==="personalDatabaseProperty" && child.attrs.id===editing.id)found=live.pos+1+offset;});
    if(found!==undefined && Object.entries({...editing,name:editing.name.trim(),deleted}).every(([key,value])=>JSON.stringify(editor.state.doc.nodeAt(found)?.attrs[key])===JSON.stringify(value))) { setEditing(null); return; }
    editor.commands.command(({tr})=>{
      if(found!==undefined)tr.setNodeMarkup(found,undefined,{...editing,name:editing.name.trim(),deleted});
      else if(definitions.length<50)tr.insert(live.pos+1,editor.schema.nodes.personalDatabaseProperty.create({...editing,name:editing.name.trim(),deleted}));
      return true;
    });setEditing(null);setError("");
  };
  const add=()=>{setError("");setEditing({id:crypto.randomUUID(),name:"",kind:"text",options:"",formula:'prop("Value") * 2',targetPageId:"",targetDatabaseId:"",relationId:"",sourceProperty:"number",aggregation:"sum",deleted:false});};
  const configuration=<Modal opened={!!editing} onClose={()=>setEditing(null)} title={t("Property settings")} centered>
    {editing&&<Stack gap="sm">
      <TextInput label={t("Property name")} maxLength={100} value={editing.name} onChange={e=>setEditing({...editing,name:e.currentTarget.value})}/>
      <Select label={t("Property type")} value={editing.kind} data={COMMUNITY_PROPERTY_TYPES.map(value=>({value,label:t(labels[value])}))} onChange={kind=>kind&&setEditing({...editing,kind})}/>
      {["select","multi_select"].includes(editing.kind)&&<TextInput label={t("Options separated by commas")} value={editing.options} onChange={e=>setEditing({...editing,options:e.currentTarget.value})}/>}
      {editing.kind==="formula"&&<Textarea label={t("Formula")} maxLength={4000} value={editing.formula} onChange={e=>setEditing({...editing,formula:e.currentTarget.value})}/>}
      {editing.kind==="relation"&&<>
        <RelationPagePicker selected={editing.targetPageId} onChange={targetPageId=>setEditing({...editing,targetPageId,targetDatabaseId:""})}/>
        <RelationDatabasePicker pageId={editing.targetPageId} selected={editing.targetDatabaseId} onChange={targetDatabaseId=>setEditing({...editing,targetDatabaseId})}/>
      </>}
      {editing.kind==="rollup"&&<>
        <Select label={t("Relation property")} data={definitions.filter(d=>d.kind==="relation").map(d=>({value:d.id,label:d.name}))} value={editing.relationId} onChange={relationId=>setEditing({...editing,relationId:relationId||""})}/>
        <TextInput label={t("Source property name or ID")} value={editing.sourceProperty} onChange={e=>setEditing({...editing,sourceProperty:e.currentTarget.value})}/>
        <Select label={t("Calculate")} data={["sum","count","average","min","max"]} value={editing.aggregation} onChange={aggregation=>aggregation&&setEditing({...editing,aggregation})}/>
      </>}
      {error&&<Text size="sm" c="red">{error}</Text>}
      <Group><Button onClick={()=>saveDefinition()}>{t("Save")}</Button>{definitions.some(d=>d.id===editing.id)&&<Button variant="subtle" color="red" onClick={()=>saveDefinition(true)}>{t("Delete property")}</Button>}</Group>
      <Text size="xs" c="dimmed">{t("Deleted property values are retained in document history.")}</Text>
    </Stack>}
  </Modal>;
  return {definitions,renderCell,configuration,add,edit:(def:Definition)=>{setError("");setEditing({...def});},value:(rowId:string,def:Definition)=>resolve(rowId,def.id)};
}
function RelationDatabasePicker({pageId,selected,onChange}:{pageId:string;selected:string;onChange:(id:string)=>void}){
  const {t}=useTranslation();
  const [result]=useQueries({queries:[{queryKey:["community-relation-picker",selectedPersonalWorkspace(),pageId],queryFn:()=>getPageById({pageId}),enabled:/^[0-9a-f-]{36}$/i.test(pageId),retry:false,staleTime:0}]});
  return <Select label={t("Source database")} value={selected} onChange={id=>id&&onChange(id)}
    data={databaseNodes(result.data?.content).filter(d=>d.attrs.id).map(d=>({value:d.attrs.id,label:d.attrs.title||t("Database")}))}
    error={result.isError?t("Source is unavailable"):undefined} disabled={!result.data} />;
}

function RelationPagePicker({selected,onChange}:{selected:string;onChange:(id:string)=>void}) {
  const {t}=useTranslation(); const [search,setSearch]=useState(""); const [pages,setPages]=useState<{value:string;label:string}[]>([]);
  useEffect(()=>{let active=true;const timer=setTimeout(()=>{searchSuggestions({query:search,includePages:true,includeUsers:false,includeGroups:false,limit:30}).then(data=>{if(active)setPages((data.pages||[]).map(page=>({value:page.id,label:page.title||t("Untitled")})));}).catch(()=>{if(active)setPages([]);});},200);return()=>{active=false;clearTimeout(timer);};},[search,t]);
  return <Select label={t("Source page")} searchable searchValue={search} onSearchChange={setSearch} value={selected} onChange={id=>typeof id==="string"&&onChange(id)} data={selected&&!pages.some(p=>p.value===selected)?[...pages,{value:selected,label:selected}]:pages}/>;
}
