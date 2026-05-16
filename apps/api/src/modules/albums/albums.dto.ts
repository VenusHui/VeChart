import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAlbumDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  description = '';
}

export class UpdateAlbumDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
