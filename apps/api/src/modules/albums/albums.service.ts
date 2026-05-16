import { Injectable } from '@nestjs/common';

import { PostgresRepository } from '../../data/postgres.repository';
import { CreateAlbumDto, UpdateAlbumDto } from './albums.dto';

@Injectable()
export class AlbumsService {
  constructor(private readonly repository: PostgresRepository) {}

  listAlbums() {
    return this.repository.listAlbums();
  }

  getAlbum(albumId: string) {
    return this.repository.getAlbum(albumId);
  }

  createAlbum(dto: CreateAlbumDto) {
    return this.repository.createAlbum(dto);
  }

  updateAlbum(albumId: string, dto: UpdateAlbumDto) {
    return this.repository.updateAlbum(albumId, dto);
  }

  removeAlbum(albumId: string) {
    return this.repository.removeAlbum(albumId);
  }

  listPhotos(albumId: string) {
    return this.repository.listPhotosByAlbum(albumId);
  }
}
