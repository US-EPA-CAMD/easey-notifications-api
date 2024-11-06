import { Injectable, HttpStatus, forwardRef, Inject } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { v4 as uuidv4 } from 'uuid';
import { SubmissionSetHelperService } from './submission-set-helper.service';
import { SubmissionEmailService } from './submission-email.service';
import { MailEvalService } from '../mail/mail-eval.service';
import { ConfigService } from '@nestjs/config';
import { SubmissionFeedbackRecordService } from './submission-feedback-record.service';
import { Plant } from '../entities/plant.entity';
import { SeverityCode } from '../entities/severity-code.entity';
import { EntityManager } from 'typeorm';
import { ReportingPeriod } from '../entities/reporting-period.entity';

@Injectable()
export class ErrorHandlerService {
  constructor(
    private readonly logger: Logger,

    @Inject(forwardRef(() => SubmissionEmailService))
    private readonly submissionEmailService: SubmissionEmailService,
    private readonly entityManager: EntityManager,
    private readonly mailEvalService: MailEvalService,
    private readonly submissionSetHelper: SubmissionSetHelperService,
    private readonly configService: ConfigService,
    private readonly submissionFeedbackRecordService: SubmissionFeedbackRecordService,
  ) {}

  async handleQueueingError(
    submissionSet: SubmissionSet,
    currentSubmissionQueue: SubmissionQueue,
    stages: { action: string; dateTime: string }[],
    userEmail: string,
    userId: string,
    rootError: Error,
  ) {
    try {

      // JSON.stringify the error note
      try {
        // Safely capture error note
        submissionSet.note = JSON.stringify({
          message: rootError?.message || 'No message',
          stack: rootError?.stack || 'No stack trace available',
          name: rootError?.name || 'UnknownError',
        });
      } catch (serializationError) {
        // Fallback in case serialization fails
        submissionSet.note = `Error serializing original error: ${serializationError.message}`;
      } finally {
        submissionSet.noteTime = new Date();
      }

      // Update the submission set status to 'ERROR'
      try {
        await this.submissionSetHelper.updateSubmissionSetStatus(submissionSet, 'ERROR', submissionSet.note);
      } catch (updateError) {
        this.logger.error('Error during handleQueueingError for submission set, while updating submission set: ' + submissionSet?.submissionSetIdentifier, updateError.stack,);
      }

      try {
        // Attempt to update submission queue records
        await this.submissionSetHelper.setRecordStatusCode(submissionSet, [currentSubmissionQueue], 'ERROR', submissionSet.note, 'REQUIRE',);
      } catch (updateQueueError) {
        this.logger.error('Error during handleQueueingError for submission set, while updating submission queue:' + submissionSet?.submissionSetIdentifier, updateQueueError.stack,);
      }

      // Generate an error ID
      const errorId = uuidv4();

      // Log the error
      this.logger.error(`Queueing Error for UserId: ${userId || 'Unknown'}`, rootError?.stack || '', 'Submission Queue', { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, errorId });

      // Prepare email context
      const emailTemplateContext = await this.buildEmailTemplateContextForUser(
        submissionSet,
        currentSubmissionQueue,
        userEmail,
        errorId,
        rootError,
      );

      // Email subject
      const processCode = currentSubmissionQueue?.processCode || 'N/A';
      const emailSubject = `${processCode} Feedback for ORIS code ${emailTemplateContext.orisCode} Unit ${emailTemplateContext.configuration}`;

      // Send failure email to user
      await this.sendEmail(
        emailTemplateContext,
        userEmail,
        '',
        emailSubject,
        'submissionQueueingFailureUserTemplate',
      );

      // Prepare email context for support
      const emailTemplateContextForSupport = await this.buildEmailTemplateContextForSupport(
        submissionSet,
        [currentSubmissionQueue],
        stages,
        emailTemplateContext,
        errorId,
        rootError,
      );

      // Send email to support
      await this.sendEmail(
        emailTemplateContextForSupport,
        emailTemplateContextForSupport.supportEmail,
        '',
        emailSubject,
        'submissionQueueingFailureSupportTemplate'
      );

    } catch (emailError) {
      this.logger.error('Failed to send queueing failure email.', emailError.stack);
    }
  }

  async handleSubmissionProcessingError(
    submissionSet: SubmissionSet,
    queueRecords: SubmissionQueue[],
    stages: { action: string; dateTime: string }[],
    rootError: Error,
  ) {

    try {
      // JSON.stringify the error note
      try {
        // Safely capture error note
        submissionSet.note = JSON.stringify({
          message: rootError?.message || 'No message',
          stack: rootError?.stack || 'No stack trace available',
          name: rootError?.name || 'UnknownError',
        });
      } catch (serializationError) {
        // Fallback in case serialization fails
        submissionSet.note = `Error serializing original error: ${serializationError.message}`;
      } finally {
        submissionSet.noteTime = new Date();
      }

      // Update the submission set status to 'ERROR'
      try {
        await this.submissionSetHelper.updateSubmissionSetStatus(submissionSet, 'ERROR', submissionSet.note);
      } catch (updateError) {
        this.logger.error('Error during handleSubmissionProcessingError for submission set, while updating submission set: ' + submissionSet?.submissionSetIdentifier, updateError.stack,);
      }

      try {
        // Attempt to update submission queue records
        await this.submissionSetHelper.setRecordStatusCode(submissionSet, queueRecords, 'ERROR', submissionSet.note, 'REQUIRE',);
      } catch (updateQueueError) {
        this.logger.error('Error during handleSubmissionProcessingError for submission set, while updating submission queue:' + submissionSet?.submissionSetIdentifier, updateQueueError.stack,);
      }

      // Generate an error ID
      const errorId = uuidv4();
      this.logger.error(rootError?.message, rootError?.stack, 'submission', {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorId: errorId,
      });

      // Prepare email context for user
      const emailTemplateContextForUser = await this.buildEmailTemplateContextForUser(
        submissionSet,
        queueRecords,
        submissionSet?.userEmail || '',
        errorId,
        rootError,
      );

      // Email subject
      const processCode = emailTemplateContextForUser.processCode || 'N/A';
      const emailSubject = `${processCode} Feedback for ORIS code ${emailTemplateContextForUser.orisCode} Unit ${emailTemplateContextForUser.configuration}`;

      // Send email to user
      await this.sendEmail(
        emailTemplateContextForUser,
        emailTemplateContextForUser.toEmail,
        '',
        emailSubject,
        'submissionFailureUserTemplate'
      );

      // Prepare email context for support
      const emailTemplateContextForSupport = await this.buildEmailTemplateContextForSupport(
        submissionSet,
        queueRecords,
        stages,
        emailTemplateContextForUser,
        errorId,
        rootError,
      );

      // Send email to support
      await this.sendEmail(
        emailTemplateContextForSupport,
        emailTemplateContextForSupport.supportEmail,
        '',
        emailSubject,
        'submissionFailureSupportTemplate'
      );

    } catch (error) {
      this.logger.error('Failed to handle submission processing error.', error?.stack || '');
    }
  }

  private async buildEmailTemplateContextForUser(
    submissionSet: SubmissionSet,
    submissionQueueOrRecords: SubmissionQueue | SubmissionQueue[],
    userEmail: string,
    errorId: string,
    rootError: Error,
  ): Promise<any> {
    // Get support email
    let supportEmail: string;
    try {
      const ecmpsClientConfig = await this.submissionEmailService.getECMPSClientConfig();
      supportEmail = ecmpsClientConfig?.supportEmail?.trim?.() || 'ecmps-support@camdsupport.com';
    } catch (configError) {
      supportEmail = 'ecmps-support@camdsupport.com';
      this.logger.error('Failed to get support email. Using: ' + supportEmail, configError.stack);
    }

    // Get CDX Url
    let cdxUrl: string;
    try {
      cdxUrl = this.configService.get<string>('app.cdxUrl') || 'https://cdx.epa.gov/';
    } catch (configError) {
      cdxUrl = 'https://cdx.epa.gov/';
      this.logger.error('Failed to get CDX URL. Using ' + cdxUrl, configError?.stack);
    }

    // Retrieve the facility information to get the State
    let facility: Plant;
    try {
      facility = submissionSet && submissionSet.facIdentifier
        ? await this.submissionSetHelper.getFacilityByFacIdentifier(submissionSet.facIdentifier)
        : null;
    } catch (facilityError) {
      this.logger.error('Failed to get facility information.', facilityError.stack);
      facility = null;
    }

    // Get submission queue or selected submission queue
    //let processCode: string = 'N/A';
    let selectedSubmissionQueue: SubmissionQueue = null;
    if (Array.isArray(submissionQueueOrRecords)) {
      try {
        const severityCodes: SeverityCode[] = await this.entityManager.find(SeverityCode);
        const highestSeverityRecord =
          await this.submissionEmailService.findRecordWithHighestSeverityLevel(
            submissionQueueOrRecords,
            severityCodes,
          );
        selectedSubmissionQueue = highestSeverityRecord?.submissionQueue;
      } catch (dateDisplayError) {
        selectedSubmissionQueue = submissionQueueOrRecords?.find(record => record != null) || null;
        this.logger.error('Failed to get submission queue.', dateDisplayError?.stack || '');
      }
    } else if (submissionQueueOrRecords) {
      selectedSubmissionQueue = submissionQueueOrRecords;
    }

    const processCode = selectedSubmissionQueue?.processCode || 'N/A';

    // Get submission type
    let submissionType: string = 'N/A';
    try {
      submissionType = await this.submissionEmailService.getSubmissionType(processCode) || 'N/A';
    } catch (submissionTypeError) {
      this.logger.error('Failed to get submission type.', submissionTypeError.stack);
    }

    // Get submission date display
    let submissionDateDisplay: string = new Date().toLocaleString();
    try {
      submissionDateDisplay = await this.submissionFeedbackRecordService.getDisplayDate(submissionSet?.queuedTime || new Date());
    } catch (dateDisplayError) {
      this.logger.error('Failed to get submission date display.', dateDisplayError.stack);
    }

    //Get yearQtr information for EM submissions
    const rptPeriod =
      processCode === 'EM'
        ? await this.entityManager.findOne(ReportingPeriod, {
          where: { rptPeriodIdentifier: selectedSubmissionQueue?.rptPeriodIdentifier },
        })
        : null;
    const yearQtr = rptPeriod?.periodAbbreviation;

    // Prepare email context
    const emailTemplateContextForUser = {
      submissionType: submissionType,
      facilityName: submissionSet?.facName || 'N/A',
      stateCode: facility?.state || 'N/A',
      orisCode: submissionSet?.orisCode || 'N/A',
      configuration: submissionSet?.configuration || 'N/A',
      submissionDateDisplay: submissionDateDisplay,
      yearQtr: yearQtr || 'N/A',
      submitter: userEmail || 'N/A',
      supportEmail: supportEmail,
      toEmail: userEmail || 'N/A',
      ccEmail: supportEmail,
      cdxUrl: cdxUrl,
      processCode: processCode,
      errorId: errorId || 'N/A',
      errorDetails: rootError?.message || 'No error details available',
    };

    return emailTemplateContextForUser;
  }

  private async buildEmailTemplateContextForSupport(
    submissionSet: SubmissionSet,
    queueRecords: SubmissionQueue[],
    stages: { action: string; dateTime: string }[],
    emailTemplateContextForUser: any,
    errorId: string,
    rootError: Error,
  ): Promise<any> {
    // Extract submissionIdentifier values from queueRecords
    const submissionQueueIdentifiers = queueRecords
      .map(record => record?.submissionIdentifier || 'N/A')
      .join(', ');

    // Get the units
    const units = emailTemplateContextForUser.configuration;

    // Construct the argument values
    const argumentValues = `Submission set: ${submissionSet?.submissionSetIdentifier || 'N/A'}, Submission Queues: ${submissionQueueIdentifiers}, Units: ${units}`;

    const emailTemplateContextForSupport = {
      ...emailTemplateContextForUser,
      submissionId: submissionSet?.submissionSetIdentifier || 'N/A',
      submitter: submissionSet?.userIdentifier || emailTemplateContextForUser.submitter || 'N/A',
      errorId: errorId || 'N/A',
      errorMessage: rootError?.message || 'No error message',
      errorDetails: rootError?.stack || 'No error details available',
      argumentValues: argumentValues,
      errorDate: new Date().toLocaleString() || 'N/A',
      stages: stages,
    };

    return emailTemplateContextForSupport;
  }

  private async sendEmail(
    emailTemplateContext: any,
    toEmail: string,
    ccEmail: string,
    subject: string,
    template: string,
  ) {

    let fromEmail: string;

    try {
      fromEmail = this.configService.get<string>('app.defaultFromEmail') || 'noreply@epa.gov';
    } catch (configError) {
      fromEmail = 'noreply@epa.gov';
      this.logger.error('Failed to get default fromEmail. Using ' + fromEmail, configError.stack);
    }

    // Send email
    if (toEmail) {
      try {
        await this.mailEvalService.sendEmailWithRetry(
          toEmail,
          ccEmail || '',
          fromEmail,
          subject,
          template, // Template name
          emailTemplateContext,
          1,
        );
      } catch (userEmailError) {
        this.logger.error('Failed to send failure email to ' + toEmail, userEmailError?.stack);
      }
    } else {
      this.logger.warn('Destination email is not provided; skipping processing failure email.');
    }
  }
}
