import { HttpStatus, Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { DataSetService } from '../dataset/dataset.service';
import { getManager } from 'typeorm';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { CopyOfRecordService } from '../copy-of-record/copy-of-record.service';
import { ReportParamsDTO } from '../dto/report-params.dto';
import * as path from 'path';
import * as FormData from 'form-data';
import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  createReadStream,
  rmSync,
} from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '@nestjs/axios';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { EaseyException } from '@us-epa-camd/easey-common/exceptions';
import { QaSuppData } from '../entities/qa-supp.entity';
import { ConfigService } from '@nestjs/config';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { MailEvalService } from '../mail/mail-eval.service';
import { MatsBulkFile } from '../entities/mats-bulk-file.entity';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class SubmissionProcessService {
  private importS3Client: S3Client;
  private globalS3Client: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    private dataSetService: DataSetService,
    private copyOfRecordService: CopyOfRecordService,
    private readonly httpService: HttpService,
    private mailEvalService: MailEvalService,
  ) {
    this.importS3Client = new S3Client({
      credentials: this.configService.get('matsConfig.importCredentials'),
      region: this.configService.get('matsConfig.importRegion'),
    });

    this.globalS3Client = new S3Client({
      credentials: this.configService.get('matsConfig.globalCredentials'),
      region: this.configService.get('matsConfig.globalRegion'),
    });
  }

  returnManager(): any {
    return getManager();
  }

  async getCopyOfRecord(
    set: SubmissionSet,
    record: SubmissionQueue,
    documents: object[],
    transactions: any[],
    folderPath: string,
  ): Promise<void> {
    record.statusCode = 'WIP';
    this.returnManager().save(record);

    const params = new ReportParamsDTO();
    params.facilityId = set.facIdentifier;

    let titleContext = '';

    switch (record.processCode) {
      case 'MP':
        params.reportCode = 'MPP';
        params.monitorPlanId = set.monPlanIdentifier;
        titleContext = 'MP_' + set.monPlanIdentifier;
        transactions.push({
          command:
            'CALL camdecmps.copy_monitor_plan_from_workspace_to_global($1)',
          params: [params.monitorPlanId],
        });
        break;
      case 'QA':
        if (record.testSumIdentifier) {
          params.reportCode = 'TEST_DETAIL';
          params.testId = [record.testSumIdentifier];
          titleContext = 'TEST_' + record.testSumIdentifier;
          transactions.push({
            command:
              'CALL camdecmps.copy_qa_test_summary_from_workspace_to_global($1)',
            params: [params.testId],
          });
        } else if (record.qaCertEventIdentifier) {
          params.reportCode = 'QCE';
          params.qceId = record.qaCertEventIdentifier;
          titleContext = 'QCE_' + record.qaCertEventIdentifier;
          transactions.push({
            command:
              'CALL camdecmps.copy_qa_qce_data_from_workspace_to_global($1)',
            params: [params.qceId],
          });
        } else {
          params.reportCode = 'TEE';
          params.teeId = record.testExtensionExemptionIdentifier;
          titleContext = 'TEE_' + record.testExtensionExemptionIdentifier;
          transactions.push({
            command:
              'CALL camdecmps.copy_qa_tee_data_from_workspace_to_global($1)',
            params: [params.teeId],
          });
        }
        break;
      case 'EM':
        params.monitorPlanId = set.monPlanIdentifier;
        params.reportCode = 'EM';

        const rptPeriod: ReportingPeriod = await this.returnManager().findOne(
          ReportingPeriod,
          {
            where: { rptPeriodIdentifier: record.rptPeriodIdentifier },
          },
        );

        params.year = rptPeriod.calendarYear;
        params.quarter = rptPeriod.quarter;

        transactions.push({
          command:
            'CALL camdecmps.copy_emissions_from_workspace_to_global($1, $2)',
          params: [params.monitorPlanId, record.rptPeriodIdentifier],
        });

        titleContext =
          'EM_' +
          params.monitorPlanId +
          '_' +
          params.year +
          'q' +
          params.quarter;
        break;
      case 'MATS':
        //Pull down the Mats Bulk File Object
        const matsRecord: MatsBulkFile = await this.returnManager().findOne(
          MatsBulkFile,
          {
            where: {
              id: record.matsBulkFileId,
            },
          },
        );

        const response = await this.importS3Client.send(
          new GetObjectCommand({
            Bucket: this.configService.get<string>('matsConfig.importBucket'),
            Key: `${set.monPlanIdentifier}/${matsRecord.testNumber}/${matsRecord.fileName}`,
          }),
        );
        const responseString = await response.Body.transformToString();

        writeFileSync(
          `${folderPath}/MATS_${set.monPlanIdentifier}_${matsRecord.testNumber}_${matsRecord.fileName}`,
          responseString,
        );

        //Upload the Mats Bulk File Object to the global bucket
        await this.globalS3Client.send(
          new PutObjectCommand({
            Body: responseString,
            Key: `${set.monPlanIdentifier}/${matsRecord.testNumber}/${matsRecord.fileName}`,
            Bucket: this.configService.get<string>('matsConfig.globalBucket'),
          }),
        );

        break;
    }

    if (record.processCode !== 'MATS') {
      //For MATS files we pull them directly from S3
      const reportInformation = await this.dataSetService.getDataSet(
        params,
        true,
      );

      documents.push({
        documentTitle: `${set.facIdentifier}_${titleContext}`,
        context:
          this.copyOfRecordService.generateCopyOfRecord(reportInformation),
      });
    }
  }

  async setRecordStatusCode(
    set: SubmissionSet,
    records: SubmissionQueue[],
    statusCode: string,
    details: string,
    originRecordCode: string,
  ) {
    for (const record of records) {
      record.statusCode = statusCode;
      record.details = details;

      let originRecord;

      switch (record.processCode) {
        case 'MP':
          originRecord = await this.returnManager().findOne(
            MonitorPlan,
            set.monPlanIdentifier,
          );

          break;
        case 'QA':
          if (record.testSumIdentifier) {
            originRecord = await this.returnManager().findOne(QaSuppData, {
              where: { testSumIdentifier: record.testSumIdentifier },
            });
          } else if (record.qaCertEventIdentifier) {
            originRecord = await this.returnManager().findOne(
              QaCertEvent,
              record.qaCertEventIdentifier,
            );
          } else {
            originRecord = await this.returnManager().findOne(
              QaTee,
              record.testExtensionExemptionIdentifier,
            );
          }
          break;
        case 'EM':
          originRecord = await this.returnManager().findOne(
            EmissionEvaluation,
            {
              where: {
                monPlanIdentifier: set.monPlanIdentifier,
                rptPeriodIdentifier: record.rptPeriodIdentifier,
              },
            },
          );
          break;
        case 'MATS':
          originRecord = await this.returnManager().findOne(MatsBulkFile, {
            where: {
              id: record.matsBulkFileId,
            },
          });
          break;
      }

      if (
        !(
          record.testSumIdentifier !== null ||
          record.rptPeriodIdentifier !== null
        ) || //The transation deletes the Test Sum and Emissions Records so don't execute this logic on final update
        originRecordCode !== 'UPDATED'
      ) {
        originRecord.submissionIdentifier = record.submissionIdentifier;
        originRecord.submissionAvailabilityCode = originRecordCode;

        await this.returnManager().save(originRecord);
      }
      await this.returnManager().save(record);
    }
  }

  async handleError(set: SubmissionSet, queue: SubmissionQueue[], e: Error) {
    set.details = JSON.stringify(e);
    set.statusCode = 'ERROR';

    await this.setRecordStatusCode(
      //Reset the original records to require
      set,
      queue,
      'ERROR',
      'Process failure, see set details',
      'REQUIRE',
    );

    await this.returnManager().save(set);

    throw new EaseyException(e, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  async successCleanup(
    folderPath,
    set: SubmissionSet,
    submissionSetRecords,
    transactions,
  ) {
    rmSync(folderPath, {
      recursive: true,
      maxRetries: 5,
      retryDelay: 1,
      force: true,
    });

    await this.returnManager().transaction(
      //Copy records from workspace to global
      async (transactionalEntityManager) => {
        try {
          for (const trans of transactions) {
            await transactionalEntityManager.query(trans.command, trans.params);
          }
        } catch (error) {
          this.handleError(set, submissionSetRecords, error);
        }
      },
    );

    await this.setRecordStatusCode(
      set,
      submissionSetRecords,
      'COMPLETE',
      '',
      'UPDATED',
    );

    set.statusCode = 'COMPLETE';
    await this.returnManager().save(set);

    this.mailEvalService.sendMassEvalEmail(
      set.userEmail,
      this.configService.get<string>('app.defaultFromEmail'),
      set.submissionSetIdentifier,
      true,
    );

    this.logger.log('Finished processing copy of record');
  }

  async processSubmissionSet(id: string): Promise<void> {
    this.logger.log(`Processing copy of record for: ${id}`);
    const set: SubmissionSet = await this.returnManager().findOne(
      SubmissionSet,
      id,
    );

    set.statusCode = 'WIP';
    await this.returnManager().save(set);

    let submissionSetRecords: SubmissionQueue[] =
      await this.returnManager().find(SubmissionQueue, {
        where: { submissionSetIdentifier: id },
      });

    const values = {
      //Order which to process copy of records
      MP: 1,
      QA: 2,
      EM: 3,
      MATS: 4,
    };

    submissionSetRecords = submissionSetRecords.sort((a, b) => {
      return values[a.processCode] - values[b.processCode];
    });

    const fileBucket = uuidv4();

    const folderPath = path.join(__dirname, fileBucket);

    mkdirSync(folderPath);

    // Iterate each record in the submission queue linked to the set and create a promise that resolves with the addition of document html string in the documents array
    const documents = [];
    const transactions: any = [];
    for (const submissionRecord of submissionSetRecords) {
      await this.getCopyOfRecord(
        set,
        submissionRecord,
        documents,
        transactions,
        folderPath,
      );
    }

    try {
      //Write the document strings to html files
      for (const doc of documents) {
        writeFileSync(`${folderPath}/${doc.documentTitle}.html`, doc.context);
      }

      // Read files from the new directory and attach them to the outgoing sign request
      const files = readdirSync(folderPath);
      const formData = new FormData();

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        formData.append('files', createReadStream(filePath), file);
      }

      formData.append('activityId', set.activityId); //

      const obs = this.httpService.post(
        `${this.configService.get<string>('app.authApi.uri')}/sign`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-api-key': this.configService.get<string>('app.apiKey'),
          },
        },
      );

      obs.subscribe({
        //Handle transmission cleanup / error handling
        error: (e) => {
          this.handleError(set, submissionSetRecords, e);
          rmSync(folderPath, {
            recursive: true,
            maxRetries: 5,
            retryDelay: 1,
            force: true,
          });
        },
        next: () => {
          //After copy of record is successful we need to remove the file directory and copy the workspace data in a transaction
          this.successCleanup(
            folderPath,
            set,
            submissionSetRecords,
            transactions,
          );
        },
      });
    } catch (e) {
      this.handleError(set, submissionSetRecords, e);
    }
  }
}
