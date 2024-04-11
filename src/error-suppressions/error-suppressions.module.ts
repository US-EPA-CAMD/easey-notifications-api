import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EsSpec } from '../entities/es-spec.entity';
import { ErrorSuppressionsRepository } from './error-suppressions.repository';
import { ErrorSuppressionsController } from './error-suppressions.controller';
import { ErrorSuppressionsService } from './error-suppressions.service';
import { ErrorSuppressionsMap } from '../maps/error-suppressions.map';

@Module({
  imports: [TypeOrmModule.forFeature([EsSpec]), HttpModule],
  controllers: [ErrorSuppressionsController],
  providers: [
    ConfigService,
    ErrorSuppressionsRepository,
    ErrorSuppressionsService,
    ErrorSuppressionsMap,
  ],
  exports: [TypeOrmModule],
})
export class ErrorSuppressionsModule {}
