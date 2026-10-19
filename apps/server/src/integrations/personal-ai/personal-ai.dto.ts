import { AI_LANGUAGES, type AiLocale } from './ai-languages';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  IsObject,
  Min,
  Max,
  Length,
  MaxLength,
} from 'class-validator';

export class ProfileAiDto {
  @IsOptional() @IsString() @MaxLength(24) profileId?: string;
}
export class SettingsAiDto {
  @IsString() @Length(24, 24) profileId: string;
  @IsOptional() @IsString() @MaxLength(200) model?: string;
}
export class PrepareAiDto {
  @IsOptional() @IsIn(Object.keys(AI_LANGUAGES)) responseLocale?: AiLocale;
  @IsUUID() pageId: string;
  @IsString() @Length(64, 64) sourceHash: string;
  @IsIn(['ask', 'summary', 'polish', 'translate']) action:
    | 'ask'
    | 'summary'
    | 'polish'
    | 'translate';
  @IsIn(['document', 'selection']) scope: 'document' | 'selection';
  @IsOptional() @IsString() @MaxLength(20_000) selectedText?: string;
  @IsOptional() @IsString() @MaxLength(2_000) instruction?: string;
  @IsOptional() @IsString() @MaxLength(50) targetLanguage?: string;
}
export class ExecuteAiDto {
  @IsUUID() id: string;
  @IsBoolean() approved: boolean;
}
export class StartAiJobDto extends PrepareAiDto {
  @IsUUID() operationId: string;
  @IsObject() sourceContent: Record<string, any>;
  @IsString() @MaxLength(2000) sourceTitle: string;
  @IsInt() @Min(0) @Max(100000) insertionIndex: number;
}
export class AiJobsDto {
  @IsUUID() pageId: string;
  @IsOptional() @IsUUID() jobId?: string;
}
