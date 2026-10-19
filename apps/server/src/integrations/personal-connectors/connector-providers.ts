import { BadRequestException } from '@nestjs/common';
import type { Connector, ConnectorId } from './connector-store';
export const connectorProviders={
  'google-drive':{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'https://www.googleapis.com/auth/drive.readonly'},
  github:{authorize:'https://github.com/login/oauth/authorize',token:'https://github.com/login/oauth/access_token',scope:'read:user'},
  notion:{authorize:'https://api.notion.com/v1/oauth/authorize',token:'https://api.notion.com/v1/oauth/token',scope:''},
};
export async function connectorFetch(url:string,init:RequestInit={},json=true):Promise<any>{
  // All callers construct fixed provider endpoints. Redirects cannot move credentials.
  if(!['https://oauth2.googleapis.com','https://www.googleapis.com','https://github.com','https://api.github.com','https://api.notion.com'].includes(new URL(url).origin))throw new BadRequestException('Unsupported provider endpoint');
  const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new BadRequestException(`Provider request failed (${response.status})`);
  const chunks:Uint8Array[]=[];let size=0;const reader=response.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw new BadRequestException('Provider response exceeds 2 MB');chunks.push(value);}}finally{await reader.cancel();}
  const text=Buffer.concat(chunks).toString('utf8');
  if(!json)return text;
  const data=JSON.parse(text);if(data.error)throw new BadRequestException('Provider rejected authorization');return data;
}
export async function exchangeConnectorCode(provider:ConnectorId,connection:Connector,code:string,redirectUri:string){
  const payload={grant_type:'authorization_code',code,redirect_uri:redirectUri};
  const isNotion=provider==='notion';
  const body=isNotion?JSON.stringify(payload):new URLSearchParams({...payload,client_id:connection.clientId,client_secret:connection.clientSecret,...(connection.verifier?{code_verifier:connection.verifier}:{})}).toString();
  return connectorFetch(connectorProviders[provider].token,{method:'POST',headers:{Accept:'application/json','Content-Type':isNotion?'application/json':'application/x-www-form-urlencoded',...(isNotion?{Authorization:'Basic '+Buffer.from(connection.clientId+':'+connection.clientSecret).toString('base64')}:{})},body});
}
export async function refreshConnector(provider:ConnectorId,connection:Connector){
  if(!connection.expiresAt || connection.expiresAt>Date.now()+60000)return connection;
  if(!connection.refreshToken)throw new BadRequestException('Reconnect this service');
  const body=provider==='notion'?JSON.stringify({grant_type:'refresh_token',refresh_token:connection.refreshToken}):new URLSearchParams({grant_type:'refresh_token',refresh_token:connection.refreshToken,client_id:connection.clientId,client_secret:connection.clientSecret}).toString();
  const data=await connectorFetch(connectorProviders[provider].token,{method:'POST',headers:{Accept:'application/json','Content-Type':provider==='notion'?'application/json':'application/x-www-form-urlencoded',...(provider==='notion'?{Authorization:'Basic '+Buffer.from(connection.clientId+':'+connection.clientSecret).toString('base64')}:{})},body});
  if(!data.access_token)throw new BadRequestException('Reconnect this service');
  return {...connection,accessToken:data.access_token,refreshToken:data.refresh_token||connection.refreshToken,expiresAt:data.expires_in?Date.now()+data.expires_in*1000:undefined};
}
export function providerHeaders(provider:ConnectorId,token:string){return {Authorization:`Bearer ${token}`,Accept:'application/json',...(provider==='github'?{'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Nopetion'}:{}),...(provider==='notion'?{'Notion-Version':'2025-09-03'}:{})};}
export async function connectorChoices(provider:ConnectorId,token:string,query:string){
  const headers=providerHeaders(provider,token);
  if(provider==='google-drive'){
    const q="trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown')";
    const data=await connectorFetch('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,pageSize:'100',fields:'files(id,name,mimeType)',orderBy:'modifiedTime desc'}),{headers});
    return (data.files||[]).filter(f=>!query||f.name.toLowerCase().includes(query.toLowerCase())).map(f=>({id:f.id,name:f.name}));
  }
  if(provider==='github'){
    const data=await connectorFetch('https://api.github.com/user/repos?per_page=100&sort=updated',{headers});
    return data.filter(r=>!query||r.full_name.toLowerCase().includes(query.toLowerCase())).map(r=>({id:r.full_name+'/README.md',name:r.full_name+' / README.md'}));
  }
  const data=await connectorFetch('https://api.notion.com/v1/search',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({query,filter:{value:'page',property:'object'},page_size:100})});
  return (data.results||[]).filter(p=>!p.in_trash).map(p=>({id:p.id,name:Object.values(p.properties||{}).flatMap((v:any)=>v.type==='title'?v.title:[]).map((v:any)=>v.plain_text).join('')||'Untitled'}));
}
export async function connectorDocument(provider:ConnectorId,token:string,sourceId:string){
  const headers=providerHeaders(provider,token);
  if(provider==='google-drive'){
    if(!/^[a-zA-Z0-9_-]{1,200}$/.test(sourceId))throw new BadRequestException('Invalid file ID');
    const file=await connectorFetch(`https://www.googleapis.com/drive/v3/files/${sourceId}?fields=id,name,mimeType,modifiedTime`,{headers});
    const uri=file.mimeType==='application/vnd.google-apps.document'?`https://www.googleapis.com/drive/v3/files/${sourceId}/export?mimeType=text%2Fplain`:`https://www.googleapis.com/drive/v3/files/${sourceId}?alt=media`;
    if(!['application/vnd.google-apps.document','text/plain','text/markdown'].includes(file.mimeType))throw new BadRequestException('Only text documents can be imported');
    return {title:file.name,text:await connectorFetch(uri,{headers},false)};
  }
  if(provider==='github'){
    const [path,query,...extra]=sourceId.split('?'),params=new URLSearchParams(query||''),ref=params.get('ref');
    if(extra.length || query && (Array.from(params.keys()).length!==1 || !ref || ref.length>200 || Array.from(ref).some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127)))throw new BadRequestException('Enter owner/repository/path');
    const parts=path.split('/');if(parts.length<3 || parts.some(p=>!p || p==='..' || p==='.' || /[?#\\]/.test(p) || Array.from(p).some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127)))throw new BadRequestException('Enter owner/repository/path');
    const file=await connectorFetch(`https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/contents/${parts.slice(2).map(encodeURIComponent).join('/')}${ref?'?ref='+encodeURIComponent(ref):''}`,{headers});
    if(file.type!=='file' || file.encoding!=='base64' || file.size>1024*1024 || !/\.(md|markdown|txt)$/i.test(file.name))throw new BadRequestException('Choose a Markdown or text file up to 1 MB');
    return {title:file.name,text:Buffer.from(file.content,'base64').toString('utf8')};
  }
  if(!/^[0-9a-f-]{32,36}$/i.test(sourceId))throw new BadRequestException('Invalid Notion page ID');
  const page=await connectorFetch('https://api.notion.com/v1/pages/'+sourceId,{headers});
  if(page.in_trash)throw new BadRequestException('Source page is in trash');
  const lines:string[]=[];let count=0;
  const visit=async(id:string,depth:number)=>{
    let cursor='';do{
      const data=await connectorFetch(`https://api.notion.com/v1/blocks/${id}/children?page_size=100${cursor?'&start_cursor='+encodeURIComponent(cursor):''}`,{headers});
      for(const block of data.results){if(++count>500)throw new BadRequestException('Notion import is limited to 500 blocks');const value=block[block.type],text=(value?.rich_text||[]).map(t=>t.plain_text||t.text?.content||'').join('');if(text)lines.push(text);if(block.has_children){if(depth>=4)throw new BadRequestException('Notion import nesting exceeds four levels');await visit(block.id,depth+1);}}
      cursor=data.has_more?data.next_cursor:'';
    }while(cursor);
  };await visit(sourceId,0);
  return {title:Object.values(page.properties||{}).flatMap((v:any)=>v.type==='title'?v.title:[]).map((v:any)=>v.plain_text).join('')||'Untitled',text:lines.join('\n')};
}
