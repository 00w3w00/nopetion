import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../encryption/encryption.service';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
export type ConnectorId='google-drive'|'github'|'notion';
export type Connector = {clientId:string;clientSecret:string;privateRepos?:boolean;accessToken?:string;refreshToken?:string;expiresAt?:number;state?:string;verifier?:string;stateExpires?:number;verifiedAt?:string};
export type ConnectorAccount=Partial<Record<ConnectorId,Connector>>;
/** Owner-bound storage separate from documents and dedicated AI credentials. */
@Injectable()
export class ConnectorStore {
  private directory=resolve(process.env.NOPETION_CONNECTORS_DATA_DIR||'data/connectors');
  constructor(private encryption:EncryptionService){}
  private file(ownerId:string){if(!/^[0-9a-f-]{36}$/i.test(ownerId))throw Error('Invalid connector owner');return join(this.directory,ownerId+'.enc');}
  read(ownerId:string):ConnectorAccount{const file=this.file(ownerId);if(!existsSync(file))return {};const envelope=JSON.parse(this.encryption.decrypt(readFileSync(file,'utf8')));if(envelope.ownerId!==ownerId)throw Error('Connector owner does not match');return envelope.connections;}
  write(ownerId:string,connections:ConnectorAccount){mkdirSync(this.directory,{recursive:true,mode:0o700});chmodSync(this.directory,0o700);const file=this.file(ownerId),temp=file+'.'+randomUUID()+'.tmp';writeFileSync(temp,this.encryption.encrypt(JSON.stringify({ownerId,connections})),{flag:'wx',mode:0o600});renameSync(temp,file);chmodSync(file,0o600);}
}
