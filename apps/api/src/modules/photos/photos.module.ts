import { Module } from '@nestjs/common';

import { PhotoAnalysisService } from './photo-analysis.service';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  controllers: [PhotosController],
  providers: [PhotoAnalysisService, PhotosService],
  exports: [PhotosService]
})
export class PhotosModule {}
