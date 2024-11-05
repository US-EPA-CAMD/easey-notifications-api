import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { DataSetModule } from '../dataset/dataset.module';
import { SubmissionProcessService } from './submission-process.service';
import { CopyOfRecordModule } from '../copy-of-record/copy-of-record.module';
import { MailModule } from '../mail/mail.module';
import { CombinedSubmissionsMap } from '../maps/combined-submissions.map';
import { EmissionsLastUpdatedMap } from '../maps/emissions-last-updated.map';
import { SubmissionFeedbackRecordService } from './submission-feedback-record.service';
import { RecipientListService } from './recipient-list.service';

@Module({
  imports: [HttpModule, DataSetModule, CopyOfRecordModule, MailModule],
  controllers: [SubmissionController],
  providers: [
    SubmissionService,
    SubmissionProcessService,
    SubmissionFeedbackRecordService,
    CombinedSubmissionsMap,
    EmissionsLastUpdatedMap,
    RecipientListService,
  ],
})
export class SubmissionModule {}
