import { getFileUrl } from "@/lib/config";
import { useEffect, useRef, useState } from "react";
import { Button, Group, Text, Select } from "@mantine/core";
import { NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { uploadFile } from "@/features/page/services/page-service";
export default function RecordingBlock({node,editor,getPos,updateAttributes}:Pick<NodeViewProps,"node"|"editor"|"getPos"|"updateAttributes">){
  const {t,i18n}=useTranslation();const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [language,setLanguage]=useState(i18n.language.startsWith("ko")?"ko":"auto");
  const recorder=useRef<MediaRecorder|null>(null),media=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(true),fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(timer.current);if(recorder.current && recorder.current.state!=="inactive")recorder.current.stop();media.current?.getTracks().forEach(track=>track.stop());};},[]);
  const save=async(file:File)=>{
    if(!file || !editor.isEditable || editor.isDestroyed || !mounted.current)return;
    setBusy(true);setError("");const pageId=editor.storage.pageId;
    try{
      if(file.size>25*1024*1024)throw Error(t("Audio must be under 25 MB"));
      const attachment=await uploadFile(file,pageId);
      const pos=getPos(),live=typeof pos==="number"&&editor.state.doc.nodeAt(pos);
      if(!mounted.current || editor.isDestroyed || !editor.isEditable || editor.storage.pageId!==pageId || live?.attrs.id!==node.attrs.id)return;
      updateAttributes({value:`/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}`,provider:attachment.id,title:attachment.fileName});
    }catch(e){if(mounted.current)setError(e.message||t("Upload failed. Try again."));}finally{if(mounted.current)setBusy(false);}
  };
  const start=async()=>{
    if(!editor.isEditable || busy)return;
    setError("");
    try{
      if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==="undefined")throw Error(t("Recording requires HTTPS and microphone permission"));
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){stream.getTracks().forEach(track=>track.stop());return;}
      media.current=stream;const parts:Blob[]=[];
      const mime=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus"].find(type=>MediaRecorder.isTypeSupported(type));
      const rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorder.current=rec;
      rec.ondataavailable=event=>{if(event.data.size)parts.push(event.data);};
      rec.onstop=()=>{stream.getTracks().forEach(track=>track.stop());clearTimeout(timer.current);if(mounted.current){setRecording(false);const type=rec.mimeType||"audio/webm",ext=type.includes("mp4")?"m4a":type.includes("ogg")?"ogg":"webm";void save(new File(parts,`recording-${Date.now()}.${ext}`,{type}));}};
      rec.start(1000);setRecording(true);timer.current=setTimeout(()=>{if(rec.state!=="inactive")rec.stop();},600000);
    }catch{media.current?.getTracks().forEach(track=>track.stop());setError(t("Microphone access failed. Check browser permissions."));}
  };
  const transcribe=async()=>{
    if(!node.attrs.provider || !editor.isEditable)return;setBusy(true);setError("");const pageId=editor.storage.pageId,attachmentId=node.attrs.provider;
    try{
      const result:any=await api.post("/local-transcription/transcribe",{attachmentId,language},{timeout:660000});
      const pos=getPos(),live=typeof pos==="number"&&editor.state.doc.nodeAt(pos);
      if(!mounted.current || editor.isDestroyed || !editor.isEditable || editor.storage.pageId!==pageId || live?.attrs.id!==node.attrs.id || live?.attrs.provider!==attachmentId)return;
      const blocks=String(result.data.text).split("\n").filter(Boolean).map(text=>({type:"paragraph",content:[{type:"text",text}]}));
      editor.chain().focus().insertContentAt(pos+live.nodeSize,blocks).run();
    }catch(e){if(mounted.current)setError(e.response?.data?.message||t("Local transcription failed"));}finally{if(mounted.current)setBusy(false);}
  };
  return <div data-recording-block>
    <Text fw={600}>{t("AI notes")}</Text><Text size="xs" c="dimmed">{t("Record or upload audio, then transcribe on this server. Up to 10 minutes / 25 MB.")}</Text>
    {node.attrs.value&&<audio controls src={getFileUrl(node.attrs.value)} style={{maxWidth:"100%"}}/>}
    <input hidden type="file" ref={fileInput} accept="audio/*" aria-label={t("Upload audio for transcription")} onChange={e=>{void save(e.currentTarget.files?.[0]);e.currentTarget.value="";}}/>
    <Group mt="xs" gap="xs">
      <Button size="xs" disabled={!editor.isEditable||busy} color={recording?"red":undefined} onClick={()=>recording?recorder.current?.stop():start()}>{t(recording?"Stop recording":"Start recording")}</Button>
      <Button size="xs" variant="default" disabled={!editor.isEditable||busy||recording} onClick={()=>fileInput.current?.click()}>{t("Upload audio")}</Button>
      <Select size="xs" w={120} aria-label={t("Transcription language")} value={language} onChange={v=>v&&setLanguage(v)} disabled={busy} data={["auto","ko","en","ja","zh","fr","de","es","it","pt","ru","ar","hi"]}/>
      <Button size="xs" variant="light" loading={busy} disabled={!editor.isEditable||recording||!node.attrs.provider} onClick={transcribe}>{t("Transcribe below")}</Button>
    </Group>{error&&<Text c="red" size="sm" role="alert">{error}</Text>}
  </div>;
}
