import { Body, Controller, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { PersonalReminderService } from './personal-reminder.service';
class PageDto { @IsUUID() pageId:string; }
class ReminderDto extends PageDto { @IsUUID() blockId:string; @IsOptional() @IsISO8601() dueAt?:string; }
@Controller('personal-reminders') @UseGuards(JwtAuthGuard) @RequireSessionAuth()
class PersonalReminderController {
  constructor(private service: PersonalReminderService) {}
  @Post('list') @HttpCode(200) list(@Body() dto:PageDto,@AuthUser() user:User){ return this.service.list(dto.pageId,user); }
  @Post('set') @HttpCode(200) set(@Body() dto:ReminderDto,@AuthUser() user:User){ return this.service.set(dto.pageId,dto.blockId,dto.dueAt,user); }
}
@Module({controllers:[PersonalReminderController],providers:[PersonalReminderService]})
export class PersonalReminderModule {}
