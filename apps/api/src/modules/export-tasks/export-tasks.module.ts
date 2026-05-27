import { forwardRef, Module } from '@nestjs/common';

import { PhotosModule } from '../photos/photos.module';
import { ShareDocumentsModule } from '../share-documents/share-documents.module';
import { ExportTasksController } from './export-tasks.controller';
import { ExportTasksService } from './export-tasks.service';

@Module({
  controllers: [ExportTasksController],
  providers: [ExportTasksService],
  imports: [PhotosModule, forwardRef(() => ShareDocumentsModule)],
  exports: [ExportTasksService]
})
export class ExportTasksModule {}
