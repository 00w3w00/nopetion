import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { User } from '@docmost/db/types/entity.types';
import { PersonalWorkspaceAccess } from '../../core/personal-workspace/personal-workspace-access.service';
import { EnvironmentService } from '../environment/environment.service';
import { ConnectorStore, type ConnectorId } from './connector-store';
import { connectorChoices, connectorDocument, connectorProviders, exchangeConnectorCode, refreshConnector } from './connector-providers';
@Injectable()
export class PersonalConnectorsService {
  private locks=new Map<string,Promise<unknown>>();
  constructor(private store:ConnectorStore,private access:PersonalWorkspaceAccess,private environment:EnvironmentService){}
  private async locked<T>(user:User,run:()=>Promise<T>|T):Promise<T>{this.access.assertOwner(user);const before=this.locks.get(user.id)||Promise.resolve();const current=before.catch(()=>{}).then(run);this.locks.set(user.id,current);try{return await current;}finally{if(this.locks.get(user.id)===current)this.locks.delete(user.id);}}
  callbackUrl(provider:ConnectorId){return this.environment.getAppUrl()+'/api/personal-connectors/callback/'+provider;}
  status(user:User){this.access.assertOwner(user);const account=this.store.read(user.id);return (Object.keys(connectorProviders) as ConnectorId[]).map((provider:ConnectorId)=>({provider,clientId:account[provider]?.clientId||'',configured:!!account[provider]?.clientSecret,connected:!!account[provider]?.accessToken,privateRepos:!!account[provider]?.privateRepos,callbackUrl:this.callbackUrl(provider),verifiedAt:account[provider]?.verifiedAt}));}
  async configure(user:User,provider:ConnectorId,clientId:string,clientSecret?:string,privateRepos=false){return this.locked(user,()=>{const account=this.store.read(user.id),prior=account[provider];if(prior&&prior.clientId!==clientId.trim()&&!clientSecret?.trim())throw new BadRequestException('Enter the client secret for the new Client ID.');const secret=clientSecret?.trim()||prior?.clientSecret;if(!clientId.trim()||!secret)throw new BadRequestException('Client ID and secret are required');const unchanged=prior?.clientId===clientId.trim()&&prior?.clientSecret===secret&&!!prior?.privateRepos===privateRepos;account[provider]=unchanged?prior:{clientId:clientId.trim(),clientSecret:secret,privateRepos};this.store.write(user.id,account);return {saved:true};});}
  async disconnect(user:User,provider:ConnectorId){return this.locked(user,()=>{const account=this.store.read(user.id),connection=account[provider];if(connection)account[provider]={clientId:connection.clientId,clientSecret:connection.clientSecret,privateRepos:connection.privateRepos};this.store.write(user.id,account);return {disconnected:true};});}
  async signIn(user:User,provider:ConnectorId){return this.locked(user,()=>{
    const account=this.store.read(user.id),connection=account[provider];if(!connection?.clientSecret)throw new BadRequestException('Configure this service first');
    connection.state=randomBytes(32).toString('base64url');connection.stateExpires=Date.now()+10*60000;
    connection.verifier=provider==='notion'?undefined:randomBytes(32).toString('base64url');this.store.write(user.id,account);
    const url=new URL(connectorProviders[provider].authorize);
    const params:Record<string,string>={client_id:connection.clientId,redirect_uri:this.callbackUrl(provider),response_type:'code',state:connection.state};
    if(provider==='notion')params.owner='user';else{params.scope=provider==='github'&&connection.privateRepos?'read:user repo':connectorProviders[provider].scope;params.code_challenge=createHash('sha256').update(connection.verifier).digest('base64url');params.code_challenge_method='S256';}
    if(provider==='google-drive'){params.access_type='offline';params.prompt='consent';params.include_granted_scopes='true';}
    url.search=new URLSearchParams(params).toString();return {url:url.toString()};
  });}
  async callback(user:User,provider:ConnectorId,state:string,code:string,error?:string){return this.locked(user,async()=>{
    const account=this.store.read(user.id),connection=account[provider];
    if(!state||!connection?.state||connection.stateExpires<Date.now()||state.length!==connection.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(connection.state)))throw new BadRequestException('OAuth state is invalid or expired');
    delete connection.state;delete connection.stateExpires;this.store.write(user.id,account);
    if(error||!code)throw new BadRequestException('Authorization cancelled');
    const data=await exchangeConnectorCode(provider,connection,code,this.callbackUrl(provider));
    if(!data.access_token)throw new BadRequestException('Provider did not return an access token');
    delete connection.verifier;connection.accessToken=data.access_token;connection.refreshToken=data.refresh_token||connection.refreshToken;connection.expiresAt=data.expires_in?Date.now()+Number(data.expires_in)*1000:undefined;
    this.store.write(user.id,account);return {connected:true};
  });}
  private async request<T>(user:User,provider:ConnectorId,run:(token:string)=>Promise<T>){return this.locked(user,async()=>{
    const account=this.store.read(user.id),connection=account[provider];if(!connection?.accessToken)throw new BadRequestException('Connect this service first');
    let active=await refreshConnector(provider,connection);
    if(active!==connection){account[provider]=active;this.store.write(user.id,account);}
    try{return await run(active.accessToken);}catch(error){
      if(!String((error as Error).message).includes('(401)')||!active.refreshToken)throw error;
      active=await refreshConnector(provider,{...active,expiresAt:1});account[provider]=active;this.store.write(user.id,account);return run(active.accessToken);
    }
  });}
  choices(user:User,provider:ConnectorId,query:string){return this.request(user,provider,token=>connectorChoices(provider,token,query));}
  verify(user:User,provider:ConnectorId){return this.request(user,provider,async token=>{
    const sources=await connectorChoices(provider,token,'');
    const account=this.store.read(user.id),connection=account[provider];
    connection.verifiedAt=new Date().toISOString();this.store.write(user.id,account);
    return {verifiedAt:connection.verifiedAt,sources};
  });}
  preview(user:User,provider:ConnectorId,sourceId:string){return this.request(user,provider,async token=>{const doc=await connectorDocument(provider,token,sourceId);if(doc.text.length>100000)throw new BadRequestException('Document exceeds 100,000 characters');return {...doc,provider,sourceId,fetchedAt:new Date().toISOString()};});}
}
