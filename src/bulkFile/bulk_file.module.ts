import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkFileMap } from 'src/maps/bulk-file-map';
import { BulkFileController } from './bulk_file.controller';
import { BulkFileMetadataRepository } from './bulk_file.repository';
import { BulkFileService } from './bulk_file.service';

@Module({
  imports: [TypeOrmModule.forFeature([BulkFileMetadataRepository])],
  controllers: [BulkFileController],
  providers: [ConfigService, BulkFileService, BulkFileMap],
  exports: [TypeOrmModule],
})
export class BulkFileModule {}