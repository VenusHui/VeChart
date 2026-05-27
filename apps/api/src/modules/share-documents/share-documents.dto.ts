import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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

  @IsInt()
  @Min(1)
  @IsOptional()
  moq?: number;
}
