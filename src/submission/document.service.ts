import { Injectable } from '@nestjs/common';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { DataSetService } from '../dataset/dataset.service';
import { CopyOfRecordService } from '../copy-of-record/copy-of-record.service';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { writeFileSync, createReadStream, readdirSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { join } from 'path';
import * as FormData from 'form-data';
import { EntityManager } from 'typeorm';

@Injectable()
export class DocumentService {
  constructor(
    private readonly dataSetService: DataSetService,
    private readonly copyOfRecordService: CopyOfRecordService,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly entityManager: EntityManager,
  ) {}

  public async buildDocumentsAndWriteToFile(set: SubmissionSet, records: SubmissionQueue[], folderPath: string): Promise<{ documentTitle: string; context: string }[]> {
    const documents = [];

    // Build evaluation reports
    this.logger.log(`Adding evaluation reports`);
    await this.addEvalReports(set, records, documents);

    // Build copy of records
    await this.buildCopyOfRecords(set, records, documents);

    // Add certification statements
    this.logger.log(`Adding certification statements`);
    await this.addCertificationStatements(set, documents);

    // Write documents to files
    this.logger.log(`Writing documents to files...`);
    for (const doc of documents) {
      writeFileSync(`${folderPath}/${doc.documentTitle}.html`, doc.context);
    }

    return documents;
  }

  public async addEvalReports(set: SubmissionSet, records: SubmissionQueue[], documents: any[]) {
    for (const rec of records) {
      if (['CRIT1', 'CRIT2', 'CRIT3', 'FATAL'].includes(rec.severityCode)) {
        const params = new ReportParamsDTO();
        params.facilityId = set.orisCode;

        let titleContext = '';

        // Add Eval Report
        if (rec.processCode === 'MP') {
          titleContext = 'MP_EVAL' + set.monPlanIdentifier;
          params.reportCode = 'MP_EVAL';
          params.monitorPlanId = set.monPlanIdentifier;
        } else if (rec.testSumIdentifier != null) {
          titleContext = 'TEST_DETAIL_EVAL';
          params.reportCode = 'TEST_EVAL';
          params.testId = [rec.testSumIdentifier];
        } else if (rec.qaCertEventIdentifier != null) {
          titleContext = 'QCE_EVAL';
          params.reportCode = 'QCE_EVAL';
          params.qceId = [rec.qaCertEventIdentifier];
        } else if (rec.testExtensionExemptionIdentifier != null) {
          titleContext = 'TEE_EVAL';
          params.reportCode = 'TEE_EVAL';
          params.teeId = [rec.testExtensionExemptionIdentifier];
        } else if (rec.processCode === 'EM') {
          // Retrieve the ReportingPeriod using the EntityManager
          const rptPeriod: ReportingPeriod = await this.entityManager.findOne(
            ReportingPeriod,
            {
              where: { rptPeriodIdentifier: rec.rptPeriodIdentifier },
            },
          );

          params.reportCode = 'EM_EVAL';
          params.monitorPlanId = set.monPlanIdentifier;
          params.year = rptPeriod.calendarYear;
          params.quarter = rptPeriod.quarter;

          titleContext =
            'EM_EVAL_' +
            params.monitorPlanId +
            '_' +
            params.year +
            'q' +
            params.quarter;
        }

        const reportInformation = await this.dataSetService.getDataSet(
          params,
          true,
        );

        documents.push({
          documentTitle: `${set.orisCode}_${titleContext}`,
          context:
            this.copyOfRecordService.generateCopyOfRecord(reportInformation),
        });
      }
    }
  }

  public async buildCopyOfRecords(set: SubmissionSet, records: SubmissionQueue[], documents: object[]) {
    const processes = ['MP', 'QA_TEST', 'QA_QCE', 'QA_TEE', 'EM'];
    for (const processCd of processes) {
      const relevantRecords = records.filter((r) => {
        if (processCd === 'MP')
          return r.processCode === 'MP';
        if (processCd === 'QA_TEST')
          return r.processCode === 'QA' && r.testSumIdentifier;
        if (processCd === 'QA_QCE')
          return r.processCode === 'QA' && r.qaCertEventIdentifier;
        if (processCd === 'QA_TEE')
          return r.processCode === 'QA' && r.testExtensionExemptionIdentifier;
        if (processCd === 'EM') return r.processCode === 'EM';
        return false;
      });

      if (relevantRecords.length > 0) {
        const params = new ReportParamsDTO();
        params.facilityId = set.orisCode;
        let titleContext = '';

        switch (processCd) {
          case 'MP':
            params.reportCode = 'MPP';
            params.monitorPlanId = set.monPlanIdentifier;
            titleContext = 'MP_' + set.monPlanIdentifier;
            break;
          case 'QA_TEST':
            params.reportCode = 'TEST_DETAIL';
            params.testId = relevantRecords
              .filter((r) => r.testSumIdentifier !== null)
              .map((o) => o.testSumIdentifier);
            titleContext = 'TEST_DETAIL';
            break;
          case 'QA_QCE':
            params.reportCode = 'QCE';
            params.qceId = relevantRecords
              .filter((r) => r.qaCertEventIdentifier !== null)
              .map((o) => o.qaCertEventIdentifier);
            titleContext = 'QCE';
            break;
          case 'QA_TEE':
            params.reportCode = 'TEE';
            params.teeId = relevantRecords
              .filter((r) => r.testExtensionExemptionIdentifier !== null)
              .map((o) => o.testExtensionExemptionIdentifier);
            titleContext = 'TEE';
            break;
          case 'EM':
            const emRecord = relevantRecords.find((r) => r.processCode === 'EM');
            params.reportCode = 'EM';
            params.monitorPlanId = set.monPlanIdentifier;
            const rptPeriod: ReportingPeriod = await this.entityManager.findOne(
              ReportingPeriod,
              {
                where: { rptPeriodIdentifier: emRecord.rptPeriodIdentifier },
              },
            );

            params.year = rptPeriod?.calendarYear;
            params.quarter = rptPeriod?.quarter;

            titleContext =
              'EM_' +
              params.monitorPlanId +
              '_' +
              params.year +
              'q' +
              params.quarter;

            break;
        }

        const reportInformation = await this.dataSetService.getDataSet(
          params,
          true,
        );

        documents.push({
          documentTitle: `${set.orisCode}_${titleContext}`,
          context:
            this.copyOfRecordService.generateCopyOfRecord(reportInformation),
        });
      }
    }
  }

  public async addCertificationStatements(set: SubmissionSet, documents: any[]) {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.configService.get<string>(
          'app.authApi.uri',
        )}/certifications/statements?monitorPlanIds=${set.monPlanIdentifier}`,
        {
          headers: {
            'x-api-key': this.configService.get<string>('app.apiKey'),
          },
        },
      ),
    );

    const statements = response.data;

    documents.push({
      documentTitle: `Certification Statements`,
      context: this.copyOfRecordService.generateCopyOfRecordCert(statements),
    });
  }

  async sendForSigning(set: SubmissionSet, folderPath: string) {
    const files = readdirSync(folderPath);
    const formData = new FormData();

    for (const file of files) {
      const filePath = join(folderPath, file);
      formData.append('files', createReadStream(filePath), file);
    }

    formData.append('activityId', set.activityId);

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.configService.get<string>('app.authApi.uri')}/sign`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-api-key': this.configService.get<string>('app.apiKey'),
          },
        },
      ),
    );

    this.logger.log('Documents sent for signing successfully.');
  }
}
