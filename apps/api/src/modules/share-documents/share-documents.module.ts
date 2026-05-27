import { forwardRef, Module } from '@nestjs/common';

import { ExportTasksModule } from '../export-tasks/export-tasks.module';
import { ShareDocumentsController } from './share-documents.controller';
import { ShareDocumentsService } from './share-documents.service';

@Module({
  controllers: [ShareDocumentsController],
  providers: [ShareDocumentsService],
  imports: [forwardRef(() => ExportTasksModule)],
  exports: [ShareDocumentsService]
})
export class ShareDocumentsModule {}
