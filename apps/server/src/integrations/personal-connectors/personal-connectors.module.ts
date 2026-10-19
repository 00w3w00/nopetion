import { Body, Controller, Get, HttpCode, Module, Param, Post, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthAccountUser } from '../../common/decorators/auth-account.decorator';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '@docmost/db/types/entity.types';
import { FastifyReply } from 'fastify';
import { PersonalConnectorsService } from './personal-connectors.service';
import { ConnectorStore, type ConnectorId } from './connector-store';
import { connectorProviders } from './connector-providers';
class ProviderDto { @IsIn(['google-drive','github','notion']) provider:ConnectorId; }
class ConfigureDto extends ProviderDto { @IsString() @MinLength(1) @MaxLength(500) clientId:string; @IsOptional() @IsString() @MaxLength(2000) clientSecret?:string; @IsOptional() @IsBoolean() privateRepos?:boolean; }
class ChoicesDto extends ProviderDto { @IsOptional() @IsString() @MaxLength(200) query:string=''; }
class PreviewDto extends ProviderDto { @IsString() @MinLength(1) @MaxLength(1000) sourceId:string; }
@Controller('personal-connectors') @UseGuards(JwtAuthGuard) @RequireSessionAuth()
class PersonalConnectorsController {
  constructor(private service:PersonalConnectorsService){}
  @Post('status') @HttpCode(200) status(@AuthAccountUser() user:User){return this.service.status(user);}
  @Post('configure') @HttpCode(200) configure(@AuthAccountUser() user:User,@Body() dto:ConfigureDto){return this.service.configure(user,dto.provider,dto.clientId,dto.clientSecret,dto.privateRepos);}
  @Post('disconnect') @HttpCode(200) disconnect(@AuthAccountUser() user:User,@Body() dto:ProviderDto){return this.service.disconnect(user,dto.provider);}
  @Post('sign-in') @HttpCode(200) signIn(@AuthAccountUser() user:User,@Body() dto:ProviderDto){return this.service.signIn(user,dto.provider);}
  @Post('choices') @HttpCode(200) choices(@AuthAccountUser() user:User,@Body() dto:ChoicesDto){return this.service.choices(user,dto.provider,dto.query);}
  @Post('verify') @HttpCode(200) verify(@AuthAccountUser() user:User,@Body() dto:ProviderDto){return this.service.verify(user,dto.provider);}
  @Post('preview') @HttpCode(200) preview(@AuthAccountUser() user:User,@Body() dto:PreviewDto){return this.service.preview(user,dto.provider,dto.sourceId);}
  @Get('callback/:provider') async callback(@AuthAccountUser() user:User,@Param('provider') provider:ConnectorId,@Query() query:Record<string,string>,@Res() reply:FastifyReply){
    if(!Object.prototype.hasOwnProperty.call(connectorProviders,provider))throw new BadRequestException('Invalid provider');
    let outcome='connected',reason='';try{await this.service.callback(user,provider,query.state,query.code,query.error);}catch(error){outcome='failed';reason=query.error==='access_denied'?'cancelled':error instanceof Error&&error.message.includes('state')?'expired':'authorization';}
    const callback=this.service.callbackUrl(provider);
    const appUrl=callback.slice(0,callback.lastIndexOf('/api/personal-connectors/callback/'));
    const params=new URLSearchParams({provider,result:outcome,...(reason?{reason}:{})});
    return reply.code(302).header('Cache-Control','no-store').header('Referrer-Policy','no-referrer').redirect(appUrl+'/settings/connections?'+params);
  }
}
@Module({controllers:[PersonalConnectorsController],providers:[ConnectorStore,PersonalConnectorsService]})
export class PersonalConnectorsModule {}
