import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSetService } from '../dataset/dataset.service';
import { SeverityCode } from '../entities/severity-code.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import {
  HighestSeverityRecord,
  SubmissionEmailParamsDto, SubmissionFeedbackEmailData,
} from '../dto/submission-email-params.dto';
import { SubmissionFeedbackRecordService } from './submission-feedback-record.service';
import { MailEvalService } from '../mail/mail-eval.service';
import { RecipientListService } from './recipient-list.service';
import { ClientConfig } from '../entities/client-config.entity';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { SubmissionTemplateService } from './submission-template.service';
import { ErrorHandlerService } from './error-handler.service';

@Injectable()
export class SubmissionEmailService {
  constructor(
    private readonly logger: Logger,
    private readonly entityManager: EntityManager,
    private readonly configService: ConfigService,
    private readonly dataSetService: DataSetService,
    private readonly submissionFeedbackRecordService: SubmissionFeedbackRecordService,
    private readonly templateService: SubmissionTemplateService,
    private readonly mailEvalService: MailEvalService,
    private readonly recipientListService: RecipientListService,

    @Inject(forwardRef(() => ErrorHandlerService))
    private readonly errorHandlerService: ErrorHandlerService,
  ) {}

  async collectFeedbackReportDataForEmail(
    set: SubmissionSet,
    submissionSetRecords: SubmissionQueue[],
    submissionStages: { action: string; dateTime: string }[],
  ) : Promise<SubmissionFeedbackEmailData[]>  {

    const severityCodes: SeverityCode[] = await this.entityManager.find(SeverityCode,);

    this.logger.debug('Grouping submission records by file type.');
    const submissionQueueRecordsByFileType = this.groupSubmissionRecords(submissionSetRecords,);

    const emailPromises = Object.entries(
      submissionQueueRecordsByFileType,
    ).map(async ([key, { processCode, records }]) => {

      if (records.length > 0) {

        try {
            const rptPeriod =
              processCode === 'EM'
                ? await this.entityManager.findOne(ReportingPeriod, {
                  where: { rptPeriodIdentifier: records[0].rptPeriodIdentifier },
                })
                : null;

            const highestSeverityRecord =
              await this.findRecordWithHighestSeverityLevel(
                records,
                severityCodes,
              );

            const submissionEmailParamsDto = new SubmissionEmailParamsDto({
              submissionSet: set,
              submissionQueueRecords: records,
              highestSeverityRecord: highestSeverityRecord,
              processCode: processCode,
              rptPeriod: rptPeriod,
              toEmail: set.userEmail,
              fromEmail: this.configService.get<string>('app.defaultFromEmail'),
            });

            return await this.getSubmissionFeedbackEmailData(submissionEmailParamsDto);
        } catch (error) {
          this.logger.error('Error while collecting feedback data for ${processCode}', error.stack, 'SubmissionEmailService');
          await this.errorHandlerService.handleSubmissionProcessingError(set, records, submissionStages, error);
          return null; // Ensure the promise resolves to a value
        }
      } else {
        return null;
      }
    });

    // Wait for all promises to resolve
    const submissionFeedbackEmailDataList = (await Promise.all(emailPromises)).filter(data => data !== null);

    // Return the array of SubmissionFeedbackEmailData
    return submissionFeedbackEmailDataList;
  }

  public groupSubmissionRecords(submissionQueueRecords: SubmissionQueue[]) {
    const submissionQueueRecordsByFileType = {
      MP: {
        processCode: 'MP',
        records: [submissionQueueRecords.find((r) => r.processCode === 'MP')].filter(
          Boolean,
        ),
      },

      qaCriticalRecords: {
        processCode: 'QA',
        records: submissionQueueRecords.filter(
          (r) =>
            r.processCode === 'QA' &&
            r.severityCode === 'CRIT1' &&
            (r.testSumIdentifier !== null ||
              r.qaCertEventIdentifier !== null ||
              r.testExtensionExemptionIdentifier !== null),
        ),
      },

      qaNonCriticalRecords: {
        processCode: 'QA',
        records: submissionQueueRecords.filter(
          (r) =>
            r.processCode === 'QA' &&
            r.severityCode !== 'CRIT1' &&
            (r.testSumIdentifier !== null ||
              r.qaCertEventIdentifier !== null ||
              r.testExtensionExemptionIdentifier !== null),
        ),
      },

      ...submissionQueueRecords
        .filter((r) => r.processCode === 'EM')
        .reduce((acc, record, index) => {
          acc[`EM_${index}`] = { processCode: 'EM', records: [record] };
          return acc;
        }, {}),
    };

    return submissionQueueRecordsByFileType;
  }

  private async getSubmissionFeedbackEmailData(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ) : Promise<SubmissionFeedbackEmailData>  {
    const submissionSet = submissionEmailParamsDto.submissionSet;
    const submissionQueueRecords = submissionEmailParamsDto.submissionQueueRecords;
    this.logger.debug(`Sending ${submissionEmailParamsDto.processCode} submission feedback email.`,);

    await this.setCommonParams(submissionEmailParamsDto);

    //Get the recipients list from the recipient's list API
    const recipientsListApiEnabled = this.configService.get<boolean>('app.recipientsListApiEnabled');

    submissionEmailParamsDto.ccEmail = recipientsListApiEnabled ? await this.recipientListService.getEmailRecipients(
        submissionSet.userIdentifier,
        submissionEmailParamsDto.processCode,
      '',
      'SUBMISSIONCONFIRMATION',
      submissionEmailParamsDto.facId?.toString(),
    ) : '';

    submissionEmailParamsDto.templateContext['toEmail'] = submissionEmailParamsDto.toEmail;
    submissionEmailParamsDto.templateContext['ccEmail'] = submissionEmailParamsDto.ccEmail;
    const emailSubject = await this.constructEmailSubject(submissionEmailParamsDto);
    this.logger.debug(`Constructed email subject: ${emailSubject}`,);

    const submissionReceiptData = await this.submissionFeedbackRecordService.getSubmissionReceiptData(submissionEmailParamsDto,);
    submissionEmailParamsDto.templateContext['submissionReceiptData'] = submissionReceiptData;

    let emissionSummaryContent = '';
    if (submissionEmailParamsDto.processCode === 'EM') {
      emissionSummaryContent = await this.getEmissionsSummaryReport(submissionEmailParamsDto,);
      emissionSummaryContent = emissionSummaryContent?.trim() ? emissionSummaryContent : 'No Data Available';
    }
    submissionEmailParamsDto.templateContext['emissionSummaryContent'] = emissionSummaryContent;

    let qaFeedbackContent = '';
    if (submissionEmailParamsDto.processCode === 'QA') {
      qaFeedbackContent = await this.getQAFeedbackReport(submissionEmailParamsDto, );
      qaFeedbackContent = qaFeedbackContent?.trim() ? qaFeedbackContent : 'No Data Available';
    }
    submissionEmailParamsDto.templateContext['qaFeedbackContent'] = qaFeedbackContent;

    let evaluationReportsContent = '';
    if (
      submissionEmailParamsDto.highestSeverityRecord &&
      submissionEmailParamsDto.highestSeverityRecord.severityCode &&
      submissionEmailParamsDto.highestSeverityRecord.severityCode
        .severityCode !== 'NONE'
    ) {
      this.logger.log(`Building evaluation reports`);
      const evaluationReportDocuments = [];
      await this.mailEvalService.buildEvalReports( submissionSet, submissionQueueRecords, evaluationReportDocuments,);

      for (const report of evaluationReportDocuments) {
        evaluationReportsContent += this.extractBodyContent(report.content);
      }
      evaluationReportsContent = evaluationReportsContent?.trim() || 'No Data Available';
      submissionEmailParamsDto.templateContext['evaluationReportsContent'] = evaluationReportsContent;
    }

    const attachmentContent = await this.templateService.renderTemplate(
      'submissionFeedbackTemplate.hbs',
      submissionEmailParamsDto.templateContext,
    );

    const feedbackAttachmentDocuments = [];
    feedbackAttachmentDocuments.push({
      filename: `${submissionSet.orisCode}_SUBMISSION_FEEDBACK.html`,
      content: attachmentContent,
    });

    //Finally, return the collected email data
    this.logger.log(`Completed processing building data for : ${submissionEmailParamsDto.processCode}`);
    return new SubmissionFeedbackEmailData(
      submissionEmailParamsDto.toEmail,
      submissionEmailParamsDto.ccEmail,
      submissionEmailParamsDto.fromEmail,
      emailSubject,
      'submissionTemplate',
      submissionEmailParamsDto.templateContext,
      feedbackAttachmentDocuments,
      submissionEmailParamsDto.submissionSet,
      submissionEmailParamsDto.submissionQueueRecords,
      submissionEmailParamsDto.processCode,
    );
  }

  private async setCommonParams(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ): Promise<void> {
    const submissionSet = submissionEmailParamsDto.submissionSet;
    submissionEmailParamsDto.epaAnalystLink = this.configService
      .get<string>('app.epaAnalystLink')
      ?.trim();

    const facilityInfoList = await this.entityManager.query(
      `
        SELECT fac.fac_id,
               fac.oris_code,
               fac.facility_name,
               string_agg(coalesce(unt.Unitid, stp.Stack_Name), ', ') as location_name,
               fac.state,
               string_agg(mpl.mon_loc_id, ', ') as mon_location_ids
        FROM  camdecmpswks.MONITOR_PLAN_LOCATION mpl
              JOIN camdecmpswks.MONITOR_LOCATION loc ON loc.Mon_Loc_Id = mpl.Mon_Loc_Id
              LEFT JOIN camdecmpswks.UNIT unt ON unt.Unit_Id = loc.Unit_Id
              LEFT JOIN camdecmpswks.STACK_PIPE stp ON stp.Stack_Pipe_Id = loc.Stack_Pipe_Id
              JOIN camd.PLANT fac ON fac.Fac_Id IN (unt.Fac_Id, stp.Fac_Id)
        WHERE mpl.mon_plan_id = $1
        GROUP BY fac.fac_id, fac.oris_code, fac.facility_name, fac.state
      `,
      [submissionSet.monPlanIdentifier],
    );

    const facilityItem = facilityInfoList.length > 0 ? facilityInfoList[0] : {};
    submissionEmailParamsDto.monLocationIds = facilityItem.mon_location_ids;
    submissionEmailParamsDto.facilityName = facilityItem.facility_name;
    submissionEmailParamsDto.facId = facilityItem.fac_id;
    submissionEmailParamsDto.orisCode = facilityItem.oris_code;
    submissionEmailParamsDto.stateCode = facilityItem.state;
    submissionEmailParamsDto.unitStackPipe = facilityItem.location_name;

    const monPlanStatus = await this.entityManager.query(
      `
        SELECT mp.MON_PLAN_ID, 
               rpBegin.BEGIN_DATE as begin_date, 
               rpEnd.END_DATE as end_date, 
               CASE WHEN NOW() < rpBegin.BEGIN_DATE THEN 'FUTURE' 
                   WHEN END_RPT_PERIOD_ID IS NOT NULL AND NOW() > camdecmpswks.Date_Add('quarter', 1, rpEnd.END_DATE) THEN 'RETIRED' 
                   WHEN END_RPT_PERIOD_ID IS NOT NULL AND NOW() > rpEnd.END_DATE THEN 'RETIRING' 
                   ELSE 'ACTIVE' END AS mon_plan_status 
        FROM camdecmpswks.MONITOR_PLAN mp 
            LEFT OUTER JOIN camdecmpsmd.reporting_period rpBegin ON rpBegin.RPT_PERIOD_ID = mp.BEGIN_RPT_PERIOD_ID 
            LEFT OUTER JOIN camdecmpsmd.reporting_period rpEnd ON rpEnd.RPT_PERIOD_ID = mp.END_RPT_PERIOD_ID 
        WHERE mp.mon_plan_id = $1
      `,
      [submissionSet.monPlanIdentifier],
    );
    submissionEmailParamsDto.monPlanStatus =
      monPlanStatus.length > 0 ? monPlanStatus[0].mon_plan_status : 'N/A';

    const mpKeys = [
      'submissionType',
      'facilityName',
      'configuration',
      'orisCode',
      'stateCode',
      'unitStackPipe',
      'submissionDateDisplay',
    ];

    submissionEmailParamsDto.templateContext['monitorPlan'] = {
      keys: mpKeys,
      item: {
        submissionType: await this.getSubmissionType(submissionEmailParamsDto.processCode),
        facilityName: submissionEmailParamsDto.facilityName || 'NA',
        configuration: submissionSet.configuration,
        orisCode: submissionEmailParamsDto.orisCode || 'NA',
        stateCode: submissionEmailParamsDto.stateCode || 'NA',
        unitStackPipe: submissionEmailParamsDto.unitStackPipe || 'NA',
        submissionDateDisplay: await this.submissionFeedbackRecordService.getDisplayDate(submissionSet.queuedTime,),
      },
    };

    submissionEmailParamsDto.templateContext['processCode'] = submissionEmailParamsDto.processCode;
    submissionEmailParamsDto.templateContext['processCodeName'] = await this.getProcessCodeName(submissionEmailParamsDto);

    const severityLevelCode = submissionEmailParamsDto?.highestSeverityRecord?.severityCode?.severityCode;

    submissionEmailParamsDto.templateContext['severityLevelCode'] = severityLevelCode;
    submissionEmailParamsDto.templateContext['hasNonNoneSeverity'] = severityLevelCode !== 'NONE';

    const ecmpsClientConfig = await this.getECMPSClientConfig();
    submissionEmailParamsDto.templateContext['supportEmail'] = ecmpsClientConfig?.supportEmail?.trim() ?? '';
    submissionEmailParamsDto.templateContext['cdxUrl'] = this.configService.get<string>('app.cdxUrl')?.trim() ?? '';
  }

  public async getECMPSClientConfig(): Promise<ClientConfig> {
    return await this.entityManager.findOne(ClientConfig, {
      where: { name: 'ecmps-ui' },
    });
  }

  public async getSubmissionType(processCode: string ): Promise<string> {
    const submissionTypeNames = {
      MP: 'Monitoring Plan',
      QA: 'QA Test',
      EM: 'Emissions',
    };

    return submissionTypeNames[processCode];
  }

  private async getProcessCodeName(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ): Promise<string> {
    const processCodeNames = {
      MP: 'monitoring plan',
      QA: 'QA and certification data',
      EM: 'quarterly emissions report',
    };

    return processCodeNames[submissionEmailParamsDto.processCode];
  }

  private async constructEmailSubject(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ): Promise<string> {
    const highestSeveritySubmissionQueueRecord = submissionEmailParamsDto?.highestSeverityRecord?.submissionQueue;
    const fileTypeAbbrev = highestSeveritySubmissionQueueRecord?.processCode;
    const orisCode = submissionEmailParamsDto.submissionSet.orisCode;
    const unitStackPipe = submissionEmailParamsDto.templateContext['monitorPlan'].item.unitStackPipe;
    const severityLevelDescription = submissionEmailParamsDto?.highestSeverityRecord?.severityCode?.severityCodeDescription;

    const env = this.configService.get<string>('app.env')?.trim()?.toLowerCase();
    const subjectSuffix = env && !['prod', 'production', ''].includes(env) ? ` (sent from ECMPS 2.0 ${env})` : '';
    return `${fileTypeAbbrev} Feedback for ORIS Code ${orisCode} ${unitStackPipe} (${severityLevelDescription})${subjectSuffix}`;
  }

  private async getEmissionsSummaryReport(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ): Promise<string> {
    const submissionSet = submissionEmailParamsDto.submissionSet;
    const emSubmissionRecords =
      submissionEmailParamsDto.submissionQueueRecords;

    let reportParams = new ReportParamsDTO();
    reportParams.monitorPlanId = submissionSet.monPlanIdentifier;
    reportParams.reportingPeriodIds = emSubmissionRecords
      .map((esr) => esr.rptPeriodIdentifier)
      .join(',');
    reportParams.reportCode = 'EM_QRT_SUM';
    const monLocationIds = submissionEmailParamsDto.monLocationIds
      .split(',')
      .map((item) => item.trim());
    const promises = [];

    for (const monLocationId of monLocationIds) {
      reportParams.locationId = monLocationId;
      const promise = this.dataSetService
        .getDataSet(reportParams, true)
        .then((report) => {
          return this.submissionFeedbackRecordService.generateSummaryTableForUnitStack(
            report,
            reportParams.locationId,
          );
        });

      promises.push(promise);
    }

    const results = await Promise.all(promises);

    const nonEmptyResults = results.filter(
      (result) => result && result.trim().length > 0,
    );

    return nonEmptyResults.length > 0 ? nonEmptyResults.join('<br><br>') : '';
  }

  private async getQAFeedbackReport(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ): Promise<string> {
    const testSubmissionRecords =
      submissionEmailParamsDto.submissionQueueRecords;

    const promises = [];

    let testReportParams = new ReportParamsDTO();
    testReportParams.reportCode = 'QAT_FEEDBACK';
    testReportParams.testId = testSubmissionRecords
      .filter((r) => r.testSumIdentifier !== null)
      .map((o) => o.testSumIdentifier);
    if (testReportParams.testId?.length > 0) {
      const promiseQat = this.dataSetService
        .getDataSet(testReportParams, true)
        .then((report) => {
          return this.submissionFeedbackRecordService.generateQATable(report);
        });
      promises.push(promiseQat);
    }

    let qceReportParams = new ReportParamsDTO();
    qceReportParams.reportCode = 'QCE_FEEDBACK';
    qceReportParams.qceId = testSubmissionRecords
      .filter((r) => r.qaCertEventIdentifier !== null)
      .map((o) => o.qaCertEventIdentifier);
    if (qceReportParams.qceId?.length > 0) {
      const promiseQce = this.dataSetService
        .getDataSet(qceReportParams, true)
        .then((report) => {
          return this.submissionFeedbackRecordService.generateQATable(report);
        });
      promises.push(promiseQce);
    }

    let teeReportParams = new ReportParamsDTO();
    teeReportParams.reportCode = 'TEE_FEEDBACK';
    teeReportParams.teeId = testSubmissionRecords
      .filter((r) => r.testExtensionExemptionIdentifier !== null)
      .map((o) => o.testExtensionExemptionIdentifier);
    if (teeReportParams.teeId?.length > 0) {
      const promiseTee = this.dataSetService
        .getDataSet(teeReportParams, true)
        .then((report) => {
          return this.submissionFeedbackRecordService.generateQATable(report);
        });
      promises.push(promiseTee);
    }

    const results = await Promise.all(promises);

    const nonEmptyResults = results.filter(
      (result) => result && result.trim().length > 0,
    );

    return nonEmptyResults.length > 0 ? nonEmptyResults.join('<br><br>') : '';
  }

  public async findRecordWithHighestSeverityLevel(
    submissionQueueRecords: SubmissionQueue[],
    severityCodes: SeverityCode[],
  ): Promise<HighestSeverityRecord> {
    const severityCodeMap = new Map<string, SeverityCode>();
    severityCodes.forEach((severityCode) => {
      severityCodeMap.set(severityCode.severityCode, severityCode);
    });

    let highestSeverityRecord: HighestSeverityRecord;
    let maxSeverityLevel = -Infinity;

    submissionQueueRecords.forEach((record) => {
      const severityCode = severityCodeMap.get(record.severityCode);
      if (
        severityCode !== undefined &&
        severityCode.severityLevel > maxSeverityLevel
      ) {
        maxSeverityLevel = severityCode.severityLevel;
        highestSeverityRecord = {
          submissionQueue: record,
          severityCode: severityCode,
        };
      }
    });

    if (highestSeverityRecord) {
      return highestSeverityRecord;
    } else {
      return {
        submissionQueue:
          submissionQueueRecords.length > 0
            ? submissionQueueRecords[0]
            : null,
        severityCode:
          submissionQueueRecords.length > 0
            ? severityCodeMap.get(submissionQueueRecords[0].severityCode) ||
            null
            : null,
      };
    }
  }

  private extractBodyContent(html: string): string {
    if (!html) {
      return '';
    }

    const bodyRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
    const bodyContentMatch = bodyRegex.exec(html);

    return bodyContentMatch ? bodyContentMatch[1].trim() : '';
  }
}
