import { Body, Controller, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '@docmost/db/types/entity.types';
import { LocalTranscriptionService } from './local-transcription.service';
class TranscribeDto { @IsUUID() attachmentId:string; @IsIn(['auto','ko','en','ja','zh','fr','de','es','it','pt','ru','ar','hi']) language:string='auto'; }
@Controller('local-transcription') @UseGuards(JwtAuthGuard) @RequireSessionAuth()
class LocalTranscriptionController {
  constructor(private service:LocalTranscriptionService){}
  @Post('status') @HttpCode(200) status(){return this.service.status();}
  @Post('transcribe') @HttpCode(200) transcribe(@Body() dto:TranscribeDto,@AuthUser() user:User){return this.service.transcribe(dto.attachmentId,dto.language,user);}
}
@Module({controllers:[LocalTranscriptionController],providers:[LocalTranscriptionService]})
export class LocalTranscriptionModule {}
