import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { StorageService } from '../storage/storage.service';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const languages = ['auto','ko','en','ja','zh','fr','de','es','it','pt','ru','ar','hi'];
@Injectable()
export class LocalTranscriptionService {
  private busy = false;
  constructor(private attachments:AttachmentRepo, private pages:PageRepo, private access:PageAccessService,
    private storage:StorageService, @InjectKysely() private db:KyselyDB) {}
  status() { return { available:existsSync('/opt/whisper/whisper-cli') && existsSync('/opt/whisper/ggml-base.bin'), engine:'whisper.cpp', model:'base', maxMinutes:10, maxBytes:25*1024*1024 }; }
  async transcribe(attachmentId:string, language:string, user:User) {
    if(!languages.includes(language))throw new BadRequestException('Unsupported transcription language');
    const attachment=await this.attachments.findByIdWithContent(attachmentId);
    if(!attachment || attachment.deletedAt || attachment.workspaceId!==user.workspaceId || !attachment.pageId)throw new NotFoundException();
    const page=await this.pages.findById(attachment.pageId);
    if(!page || page.deletedAt || page.workspaceId!==user.workspaceId)throw new NotFoundException();
    await this.access.validateCanEdit(page,user);
    if(!['.wav','.webm','.mp3','.m4a','.ogg','.flac','.mp4'].includes(attachment.fileExt.toLowerCase()) || Number(attachment.fileSize)>25*1024*1024)
      throw new BadRequestException('Choose an audio file up to 25 MB');
    if(attachment.textContent)return {text:attachment.textContent,cached:true,engine:'whisper.cpp'};
    if(!this.status().available)throw new ServiceUnavailableException('The local transcription engine is unavailable');
    if(this.busy)throw new ServiceUnavailableException('Local transcription is busy; try again after it finishes');
    this.busy=true;let directory:string;
    try {
      directory=await mkdtemp(join(tmpdir(),'nopetion-transcription-'));
      const input=join(directory,'input'+attachment.fileExt.toLowerCase()), wav=join(directory,'audio.wav'), output=join(directory,'transcript');
      const stream=await this.storage.readStream(attachment.filePath);const chunks:Buffer[]=[];let size=0;
      try{for await(const chunk of stream){size+=chunk.length;if(size>25*1024*1024)throw new BadRequestException('Audio exceeds the transcription limit');chunks.push(Buffer.from(chunk));}}finally{stream.destroy();}
      await writeFile(input,Buffer.concat(chunks),{mode:0o600});
      await exec('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-format_whitelist','wav,matroska,webm,mp3,mov,ogg,flac','-i',input,'-t','601','-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',wav],{timeout:60000,maxBuffer:1024*1024});
      if((await stat(wav)).size>600*32000+1024)throw new BadRequestException('Audio must be no longer than 10 minutes');
      await exec('/opt/whisper/whisper-cli',['-m','/opt/whisper/ggml-base.bin','-f',wav,'-l',language,'-t','2','-otxt','-of',output,'-np'],{timeout:10*60000,maxBuffer:1024*1024});
      const text=(await readFile(output+'.txt','utf8')).trim().slice(0,100000);
      if(!text)throw new BadRequestException('No speech was detected');
      // Recheck permission after potentially long processing, then commit before returning.
      const fresh=await this.pages.findById(page.id);if(!fresh || fresh.deletedAt)throw new NotFoundException();
      await this.access.validateCanEdit(fresh,user);
      await this.db.updateTable('attachments').set({textContent:text}).where('id','=',attachment.id).where('deletedAt','is',null).execute();
      return {text,cached:false,engine:'whisper.cpp'};
    } catch(error) {
      if(error instanceof BadRequestException || error instanceof NotFoundException || (error as any)?.getStatus)throw error;
      throw new BadRequestException('Audio could not be decoded or transcribed locally');
    } finally {if(directory)await rm(directory,{recursive:true,force:true});this.busy=false;}
  }
}
