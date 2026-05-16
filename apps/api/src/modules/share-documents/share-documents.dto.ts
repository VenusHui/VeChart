import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateShareDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  description = '';

  @IsArray()
  @ArrayMinSize(1)
  photoIds!: string[];
}
