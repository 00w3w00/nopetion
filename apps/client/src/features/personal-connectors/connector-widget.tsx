import { useState } from "react";
import { Button, Text } from "@mantine/core";
import { NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
export default function ConnectorWidget({node,editor,getPos}:Pick<NodeViewProps,"node"|"editor"|"getPos">){
  const {t}=useTranslation();const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const refresh=async()=>{
    if(!editor.isEditable)return;setBusy(true);setError("");const pageId=editor.storage.pageId,sourceId=node.attrs.value,provider=node.attrs.provider;
    try{
      const response:any=await api.post('/personal-connectors/preview',{provider,sourceId});const doc=response.data;
      const pos=getPos(),live=typeof pos==='number'&&editor.state.doc.nodeAt(pos);
      if(editor.isDestroyed||!editor.isEditable||editor.storage.pageId!==pageId||live?.attrs.id!==node.attrs.id||live?.attrs.value!==sourceId)return;
      editor.chain().focus().insertContentAt(pos+live.nodeSize,[{type:'heading',attrs:{level:3},content:[{type:'text',text:doc.title+' · '+new Date(doc.fetchedAt).toLocaleString()}]},...doc.text.split('\n').map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))]).run();
    }catch(e){setError(e.response?.data?.message||t('Source is unavailable'));}finally{setBusy(false);}
  };
  return <div><Text size="sm">{node.attrs.title} · {node.attrs.provider}</Text><Text size="xs" c="dimmed">{t('Refresh adds a new snapshot below this block.')}</Text><Button mt="xs" size="xs" variant="default" loading={busy} disabled={!editor.isEditable} onClick={refresh}>{t('Refresh source')}</Button>{error&&<Text c="red" size="sm">{error}</Text>}</div>;
}
