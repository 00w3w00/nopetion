import {
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PdfTreeDto {
  @IsUUID() pageId: string;
}

export class PdfSelectedPageDto {
  @IsUUID() pageId: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) sourceHash: string;
  @IsString() @MaxLength(5000) title: string;
}

export class ExportPdfDto {
  @IsUUID() pageId: string;
  // When exporting the open editor, refuse a snapshot older than its saved source.
  @IsOptional() @IsString() @Matches(/^[a-f0-9]{64}$/) sourceHash?: string;
  @IsOptional() @IsString() @MaxLength(5000) title?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(29)
  @ArrayUnique((page: PdfSelectedPageDto) => page?.pageId)
  @ValidateNested({ each: true }) @Type(() => PdfSelectedPageDto)
  selectedPages?: PdfSelectedPageDto[];
}
