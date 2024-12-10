import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationErrorHandlerService } from './evaluation-error-handler.service';
import { EvaluationSetHelperService } from './evaluation-set-helper.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [HttpModule, MailModule],
  controllers: [EvaluationController],
  providers: [EvaluationService, EvaluationErrorHandlerService, EvaluationSetHelperService],
})
export class EvaluationModule {}
