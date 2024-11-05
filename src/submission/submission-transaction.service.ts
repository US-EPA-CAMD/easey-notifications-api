import { Injectable } from '@nestjs/common';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { MatsBulkFile } from '../entities/mats-bulk-file.entity';
import { EntityManager } from 'typeorm';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { createReadStream, writeFileSync } from 'fs';

@Injectable()
export class SubmissionTransactionService {
  private importS3Client: S3Client;
  private globalS3Client: S3Client;

  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly entityManager: EntityManager,
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

  async buildTransactions(set: SubmissionSet, records: SubmissionQueue[], folderPath: string, transactions: any[],): Promise<any[]> {

    this.logger.log(`building transactions...`);
    for (const record of records) {
      switch (record.processCode) {
        case 'MP':
          transactions.push({
            command: 'CALL camdecmps.copy_monitor_plan_from_workspace_to_global($1)',
            params: [set.monPlanIdentifier],
          });
          break;
        case 'QA':
          if (record.testSumIdentifier) {
            transactions.push({
              command: 'CALL camdecmps.copy_qa_test_summary_from_workspace_to_global($1)',
              params: [record.testSumIdentifier],
            });
          } else if (record.qaCertEventIdentifier) {
            transactions.push({
              command: 'CALL camdecmps.copy_qa_qce_data_from_workspace_to_global($1)',
              params: [record.qaCertEventIdentifier],
            });
          } else {
            transactions.push({
              command: 'CALL camdecmps.copy_qa_tee_data_from_workspace_to_global($1)',
              params: [record.testExtensionExemptionIdentifier],
            });
          }
          break;
        case 'EM':
          transactions.push({
            command: 'CALL camdecmps.copy_emissions_from_workspace_to_global($1, $2)',
            params: [set.monPlanIdentifier, record.rptPeriodIdentifier],
          });
          break;
        case 'MATS':
          await this.processMatsRecord(set, record, folderPath);
          break;
      }
    }

    return transactions;
  }

 private async processMatsRecord(set: SubmissionSet, record: SubmissionQueue, folderPath: string) {
    const matsRecord = await this.entityManager.findOne(MatsBulkFile, {
      where: { id: record.matsBulkFileId },
    });

    const getObjectResponse = await this.importS3Client.send(
      new GetObjectCommand({
        Bucket: this.configService.get<string>('matsConfig.importBucket'),
        Key: matsRecord.bucketLocation,
      }),
    );

    //Read file content as a byte-array instead of as a string. This correctly processes binary and non-binarry files.
    const filePath = `${folderPath}/MATS_${set.monPlanIdentifier}_${matsRecord.testTypeGroup}_${matsRecord.testNumber}_${matsRecord.fileName}`;
    const bodyContents = await getObjectResponse.Body.transformToByteArray();
    writeFileSync(filePath, Buffer.from(bodyContents));

    //Upload the Mats Bulk File Object to the global bucket
    await this.globalS3Client.send(
      new PutObjectCommand({
        Body: createReadStream(filePath),
        Key: matsRecord.bucketLocation,
        Bucket: this.configService.get<string>('matsConfig.globalBucket'),
      }),
    );
  }
}
