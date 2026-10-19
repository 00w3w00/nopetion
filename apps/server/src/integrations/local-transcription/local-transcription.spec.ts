import { LocalTranscriptionService } from './local-transcription.service';
import { ForbiddenException } from '@nestjs/common';
const user={id:'user',workspaceId:'workspace'} as any;
describe('Local audio authorization',()=>{
  let service:LocalTranscriptionService,attachments:any,pages:any,access:any,storage:any;
  beforeEach(()=>{attachments={findByIdWithContent:jest.fn().mockResolvedValue({id:'audio',pageId:'page',workspaceId:'workspace',fileExt:'.wav',fileSize:'1000',textContent:'stored words'})};pages={findById:jest.fn().mockResolvedValue({id:'page',workspaceId:'workspace'})};access={validateCanEdit:jest.fn()};storage={readStream:jest.fn()};service=new LocalTranscriptionService(attachments,pages,access,storage,{} as any);});
  it('checks page authorization before returning a cached transcript',async()=>{
    access.validateCanEdit.mockRejectedValue(new ForbiddenException());await expect(service.transcribe('audio','ko',user)).rejects.toThrow(ForbiddenException);expect(storage.readStream).not.toHaveBeenCalled();
  });
  it('refuses another workspace attachment even when a transcript is cached',async()=>{
    attachments.findByIdWithContent.mockResolvedValue({workspaceId:'other',textContent:'private words'});await expect(service.transcribe('audio','ko',user)).rejects.toThrow();expect(pages.findById).not.toHaveBeenCalled();
  });
  it('refuses trash and nonaudio data without launching a decoder',async()=>{
    pages.findById.mockResolvedValue({workspaceId:'workspace',deletedAt:new Date()});await expect(service.transcribe('audio','ko',user)).rejects.toThrow();expect(storage.readStream).not.toHaveBeenCalled();
    pages.findById.mockResolvedValue({workspaceId:'workspace'});attachments.findByIdWithContent.mockResolvedValue({workspaceId:'workspace',pageId:'page',fileExt:'.m3u',fileSize:'100',textContent:'cached'});await expect(service.transcribe('audio','ko',user)).rejects.toThrow();
  });
  it('returns authorized committed text without any external provider request',async()=>{
    expect(await service.transcribe('audio','ko',user)).toEqual({text:'stored words',cached:true,engine:'whisper.cpp'});expect(access.validateCanEdit).toHaveBeenCalled();expect(storage.readStream).not.toHaveBeenCalled();
  });
});
