import { Global, Module } from '@nestjs/common';

import { CosStorageService } from './cos-storage.service';
import { PostgresRepository } from './postgres.repository';
import { PostgresService } from './postgres.service';

@Global()
@Module({
  providers: [PostgresService, CosStorageService, PostgresRepository],
  exports: [PostgresService, CosStorageService, PostgresRepository]
})
export class DataModule {}
