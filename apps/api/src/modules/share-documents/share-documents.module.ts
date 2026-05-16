import { Module } from '@nestjs/common';

import { ShareDocumentsController } from './share-documents.controller';
import { ShareDocumentsService } from './share-documents.service';

@Module({
  controllers: [ShareDocumentsController],
  providers: [ShareDocumentsService],
  exports: [ShareDocumentsService]
})
export class ShareDocumentsModule {}
