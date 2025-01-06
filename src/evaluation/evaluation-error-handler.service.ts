import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EvaluationSet } from '../entities/evaluation-set.entity';
import { Evaluation } from '../entities/evaluation.entity';
import { v4 as uuidv4 } from 'uuid';
import { EvaluationSetHelperService } from './evaluation-set-helper.service';
import { MailEvalService } from '../mail/mail-eval.service';
import { ConfigService } from '@nestjs/config';
import { Plant } from '../entities/plant.entity';
import { EntityManager } from 'typeorm';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { EvalErrorParamsDTO } from '../dto/eval-error-params.dto';

@Injectable()
export class EvaluationErrorHandlerService {
  constructor(
    private readonly logger: Logger,
    private readonly entityManager: EntityManager,
    private readonly mailEvalService: MailEvalService,
    private readonly evaluationSetHelper: EvaluationSetHelperService,
    private readonly configService: ConfigService,
  ) {}

  async sendQueueingErrorEmail(
    evalErrorParamsDTO: EvalErrorParamsDTO
  ) {

    let evaluation: EvaluationSet;
    if (evalErrorParamsDTO.evaluationSetId) {
      evaluation = await this.entityManager.findOneBy(EvaluationSet, {
        evaluationSetIdentifier: evalErrorParamsDTO.evaluationSetId,
      });
    }

    if (!evaluation) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Evaluation Set Not Found',
          message: 'Failed to send evaluation error email. No evaluation set record is found for evaluation set id: ' + evalErrorParamsDTO.evaluationSetId,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let evaluationQueue: Evaluation;
    if (evalErrorParamsDTO.evaluationId) {
      evaluationQueue = await this.entityManager.findOneBy(Evaluation, {
        evaluationIdentifier: evalErrorParamsDTO.evaluationId,
      });
    }

    const evaluationStages = evalErrorParamsDTO.evaluationStages || [];
    const rootError = !evalErrorParamsDTO.rootError ? new Error('No error message') : new Error(evalErrorParamsDTO.rootError);

    await this.handleQueueingError(evaluation, evaluationQueue, evaluationStages, evaluation.userEmail, evaluation.userIdentifier, rootError, true);
  }

  async handleQueueingError(
    evaluationSet: EvaluationSet,
    currentEvaluationQueue: Evaluation,
    stages: { action: string; dateTime: string }[],
    userEmail: string,
    userId: string,
    rootError: Error,
    skipUpdatingEvaluationRecords: boolean = false,
  ) {
    try {
      // JSON.stringify the error note
      const errorNote = JSON.stringify({
        message: rootError?.message || 'No message',
        stack: rootError?.stack || 'No stack trace available',
        name: rootError?.name || 'UnknownError',
      });

      // Update the evaluation set status to 'ERROR'
      try {
        // Attempt to update evaluation queue records
        if (!skipUpdatingEvaluationRecords) {
          await this.evaluationSetHelper.setRecordStatusCode(
            evaluationSet,
            [currentEvaluationQueue],
            'ERROR',
            errorNote,
          );
        }
      } catch (updateQueueError) {
        this.logger.error(
          'Error during handleQueueingError for evaluation set, while updating evaluation queue:' +
          evaluationSet?.evaluationSetIdentifier,
          updateQueueError.stack,
        );
      }

      // Generate an error ID
      const errorId = uuidv4();

      // Log the error
      this.logger.error(
        `Queueing Error for UserId: ${userId || 'Unknown'}`,
        rootError?.stack || '',
        'Evaluation Queue',
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, errorId },
      );

      // Prepare email context
      const emailTemplateContext = await this.buildEmailTemplateContextForUser(
        evaluationSet,
        currentEvaluationQueue,
        userEmail,
        errorId,
        rootError,
      );

      // Email subject
      const processCode = currentEvaluationQueue?.processCode || 'N/A';
      const emailSubject = `${processCode} Evaluation Feedback for ORIS code ${emailTemplateContext.orisCode} Unit ${emailTemplateContext.configuration}`;

      // Send failure email to user
      await this.sendEmail(
        emailTemplateContext,
        userEmail,
        '',
        emailSubject,
        'queueingFailureUserTemplate',
      );

      // Prepare email context for support
      const emailTemplateContextForSupport =
        await this.buildEmailTemplateContextForSupport(
          evaluationSet,
          [currentEvaluationQueue],
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
        'queueingFailureSupportTemplate',
      );
    } catch (emailError) {
      this.logger.error(
        'Failed to send evaluation queueing failure email.',
        emailError.stack,
      );
    }
  }

  private async buildEmailTemplateContextForUser(
    evaluationSet: EvaluationSet,
    evaluationQueueOrRecords: Evaluation | Evaluation[],
    userEmail: string,
    errorId: string,
    rootError: Error,
  ): Promise<any> {
    // Get support email
    let supportEmail: string;
    try {
      const ecmpsClientConfig = await this.evaluationSetHelper.getECMPSClientConfig();
      supportEmail = ecmpsClientConfig?.supportEmail?.trim?.() || 'ecmps-support@camdsupport.com';
    } catch (configError) {
      supportEmail = 'ecmps-support@camdsupport.com';
      this.logger.error( 'Failed to get support email. Using: ' + supportEmail, configError.stack, );
    }

    // Get CDX Url
    let cdxUrl: string;
    try {
      cdxUrl =
        this.configService.get<string>('app.cdxUrl') ||
        'https://cdx.epa.gov/';
    } catch (configError) {
      cdxUrl = 'https://cdx.epa.gov/';
      this.logger.error(
        'Failed to get CDX URL. Using ' + cdxUrl,
        configError?.stack,
      );
    }

    // Retrieve the facility information to get the State
    let facility: Plant;
    try {
      facility =
        evaluationSet && evaluationSet.facIdentifier
          ? await this.evaluationSetHelper.getFacilityByFacIdentifier(
            evaluationSet.facIdentifier,
          )
          : null;
    } catch (facilityError) {
      this.logger.error(
        'Failed to get facility information.',
        facilityError.stack,
      );
      facility = null;
    }

    // Get evaluation queue or selected evaluation queue
    let selectedEvaluationQueue: Evaluation = null;
    if (Array.isArray(evaluationQueueOrRecords)) {
      selectedEvaluationQueue =
        evaluationQueueOrRecords?.find((record) => record != null) || null;
    } else if (evaluationQueueOrRecords) {
      selectedEvaluationQueue = evaluationQueueOrRecords;
    }

    const processCode = selectedEvaluationQueue?.processCode || 'N/A';

    // Get evaluation type
    let evaluationType: string = 'N/A';
    try {
      evaluationType = await this.evaluationSetHelper.getEvaluationType(
        processCode,
      );
    } catch (evaluationTypeError) {
      this.logger.error( 'Failed to get evaluation type.', evaluationTypeError.stack, );
    }

    // Get submission date display
    let evaluationQueueDateDisplay: string = new Date().toLocaleString();
    try {
      evaluationQueueDateDisplay =
        await this.evaluationSetHelper.getFormattedDateTime(
          evaluationSet?.submittedOn || new Date(),
        );
    } catch (dateDisplayError) {
      this.logger.error('Failed to get submission date display.', dateDisplayError.stack, );
    }

    // Get yearQtr information for EM evaluations
    const rptPeriod =
      processCode === 'EM'
        ? await this.entityManager.findOne(ReportingPeriod, {
          where: {
            rptPeriodIdentifier: selectedEvaluationQueue?.rptPeriodIdentifier,
          },
        })
        : null;
    const yearQtr = rptPeriod?.periodAbbreviation;

    // Prepare email context
    const emailTemplateContextForUser = {
      evaluationType: evaluationType,
      facilityName: evaluationSet?.facName || 'N/A',
      stateCode: facility?.state || 'N/A',
      orisCode: evaluationSet?.orisCode || 'N/A',
      configuration: evaluationSet?.configuration || 'N/A',
      evaluationQueueDateDisplay: evaluationQueueDateDisplay,
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
    evaluationSet: EvaluationSet,
    evaluationRecords: Evaluation[],
    stages: { action: string; dateTime: string }[],
    emailTemplateContextForUser: any,
    errorId: string,
    rootError: Error,
  ): Promise<any> {
    // Extract evaluationIdentifier values from evaluationRecords
    const evaluationQueueIdentifiers = evaluationRecords
      .map((record) => record?.evaluationIdentifier || 'N/A')
      .join(', ');

    // Get the units
    const units = emailTemplateContextForUser.configuration;

    // Construct the argument values
    const argumentValues = `Evaluation set: ${
      evaluationSet?.evaluationSetIdentifier || 'N/A'
    }, Evaluation Queues: ${evaluationQueueIdentifiers}, Units: ${units}`;

    const emailTemplateContextForSupport = {
      ...emailTemplateContextForUser,
      evaluationId: evaluationSet?.evaluationSetIdentifier || 'N/A',
      submitter:
        evaluationSet?.userIdentifier ||
        emailTemplateContextForUser.submitter ||
        'N/A',
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
      fromEmail =
        this.configService.get<string>('app.defaultFromEmail') ||
        'noreply@epa.gov';
    } catch (configError) {
      fromEmail = 'noreply@epa.gov';
      this.logger.error( 'Failed to get default fromEmail. Using ' + fromEmail, configError.stack, );
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
        this.logger.error( 'Failed to send failure email to ' + toEmail, userEmailError?.stack, );
      }
    } else {
      this.logger.warn( 'Destination email is not provided; skipping processing failure email.', );
    }
  }
}
