import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { dbConfig } from '@us-epa-camd/easey-common/config';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { CorsOptionsModule } from '@us-epa-camd/easey-common/cors-options';
import { DbLookupValidator } from '@us-epa-camd/easey-common/validators';

import routes from './routes';
import s3Config from './config/s3.config';
import appConfig from './config/app.config';
import matsConfig from './config/mats.config';
import { TypeOrmConfigService } from './config/typeorm.config';
import { IsValidLocationsValidator } from './validators/is-valid-locations.validator';

import { BulkFileModule } from './bulk-file/bulk-file.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { LoggingModule } from './logging/logging.module';
import { ReportModule } from './report/report.module';
import { ReportWorkspaceModule } from './report-workspace/report.module';
import { MailModule } from './mail/mail.module';
import { ErrorSuppressionsModule } from './error-suppressions/error-suppressions.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { AdminModule } from './admin/admin.module';
import { QaTestExtensionExemptionModule } from './qa-test-extension-exemption/qa-test-extension-exemption.module';
import { QaCertEventModule } from './qa-cert-event/qa-cert-event.module';
import { QaTestSummaryModule } from './qa-test-summary/qa-test-summary.module';
import { EmSubmissionAccessModule } from './em-submission-access/em-submission-access.module';
import { SubmissionModule } from './submission/submission.module';
import { MatsFileUploadModule } from './mats-file-upload/mats-file-upload.module';
import { CopyOfRecordModule } from './copy-of-record/copy-of-record.module';

@Module({
  imports: [
    RouterModule.register(routes),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [s3Config, dbConfig, appConfig, matsConfig],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    LoggerModule,
    CorsOptionsModule,
    BulkFileModule,
    BookmarkModule,
    LoggingModule,
    ReportModule,
    ReportWorkspaceModule,
    MailModule,
    ErrorSuppressionsModule,
    EvaluationModule,
    AdminModule,
    QaTestExtensionExemptionModule,
    QaCertEventModule,
    QaTestSummaryModule,
    EmSubmissionAccessModule,
    SubmissionModule,
    MatsFileUploadModule,
    CopyOfRecordModule,
  ],
  providers: [DbLookupValidator, IsValidLocationsValidator],
})
export class AppModule {}
