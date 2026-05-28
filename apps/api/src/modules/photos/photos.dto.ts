import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

function blankToUndefined({ value }: { value: unknown }) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export class ProductMetadataDraftDto {
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUrl()
  product1688Url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marketPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  moq?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePhotoDto {
  @IsString()
  @MinLength(10)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  primaryCategory?: string;

  @IsOptional()
  @IsString()
  secondaryCategory?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataDraftDto)
  metadata?: ProductMetadataDraftDto;
}

export class UpdatePhotoDto {
  @ValidateNested()
  @Type(() => ProductMetadataDraftDto)
  metadata!: ProductMetadataDraftDto;

  @IsOptional()
  @IsString()
  primaryCategory?: string;

  @IsOptional()
  @IsString()
  secondaryCategory?: string;
}

export class ConfirmPhotoAnalysisDto {
  @ValidateNested()
  @Type(() => ProductMetadataDraftDto)
  metadata!: ProductMetadataDraftDto;
}

export class ListPhotosQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;
}
