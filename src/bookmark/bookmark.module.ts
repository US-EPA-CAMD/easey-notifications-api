import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookmarkController } from './bookmark.controller';
import { BookmarkService } from './bookmark.service';
import { BookmarkRepository } from './bookmark.repository';
import { BookmarkMap } from '../maps/bookmark.map';

@Module({
  imports: [TypeOrmModule.forFeature([BookmarkRepository]), HttpModule],
  controllers: [BookmarkController],
  providers: [ConfigService, BookmarkRepository, BookmarkService, BookmarkMap],
  exports: [TypeOrmModule],
})
export class BookmarkModule {}
