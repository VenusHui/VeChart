import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DataModule } from './data/data.module';
import { AuthModule } from './modules/auth/auth.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ExportTasksModule } from './modules/export-tasks/export-tasks.module';
import { ShareDocumentsModule } from './modules/share-documents/share-documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DataModule,
    AuthModule,
    AlbumsModule,
    PhotosModule,
    ShareDocumentsModule,
    ExportTasksModule
  ]
})
export class AppModule {}
