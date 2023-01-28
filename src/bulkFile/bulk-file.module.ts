import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkFileMap } from '../maps/bulk-file-map';
import { BulkFileMetadataRepository } from './bulk-file.repository';
import { BulkFileService } from './bulk-file.service';
import { BulkFileController } from './bulk-file.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BulkFileMetadataRepository,
    ]),
    HttpModule,
  ],
  controllers: [BulkFileController],
  providers: [
    ConfigService,
    BulkFileMap,
    BulkFileService,
  ],
  exports: [TypeOrmModule],
})
export class BulkFileModule {}
