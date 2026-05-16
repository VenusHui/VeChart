import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto, UpdateAlbumDto } from './albums.dto';

@UseGuards(JwtAuthGuard)
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get()
  listAlbums() {
    return this.albumsService.listAlbums();
  }

  @Post()
  createAlbum(@Body() dto: CreateAlbumDto) {
    return this.albumsService.createAlbum(dto);
  }

  @Get(':albumId')
  getAlbum(@Param('albumId') albumId: string) {
    return this.albumsService.getAlbum(albumId);
  }

  @Patch(':albumId')
  updateAlbum(@Param('albumId') albumId: string, @Body() dto: UpdateAlbumDto) {
    return this.albumsService.updateAlbum(albumId, dto);
  }

  @Delete(':albumId')
  removeAlbum(@Param('albumId') albumId: string) {
    return this.albumsService.removeAlbum(albumId);
  }

  @Get(':albumId/photos')
  listPhotos(@Param('albumId') albumId: string) {
    return this.albumsService.listPhotos(albumId);
  }
}
