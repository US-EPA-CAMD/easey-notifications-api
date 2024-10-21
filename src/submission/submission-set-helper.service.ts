import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { MatsBulkFile } from '../entities/mats-bulk-file.entity';
import { currentDateTime } from '@us-epa-camd/easey-common/utilities/functions';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { QaSuppData } from '../entities/qa-supp.entity';
import { Plant } from '../entities/plant.entity';

@Injectable()
export class SubmissionSetHelperService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,
  ) {}

  async updateSubmissionSetStatus(
    submissionSet: SubmissionSet,
    statusCode: string,
    note: string = '',
  ): Promise<void> {
    submissionSet.statusCode = statusCode;
    if (note) {
      submissionSet.note = note;
      submissionSet.noteTime = new Date();
    }

    if (statusCode === 'WIP') {
      submissionSet.startedTime = new Date();
    }

    if (statusCode === 'COMPLETE') {
      submissionSet.completedTime = new Date();
    }

    await this.entityManager.save(submissionSet);
  }

  async setRecordStatusCode(
    set: SubmissionSet,
    records: SubmissionQueue[],
    statusCode: string,
    note: string,
    originRecordCode: string,
  ): Promise<void> {
    for (const record of records) {
      record.statusCode = statusCode;

      if (note) {
        record.note = note;
        record.noteTime = new Date();
      }

      if (statusCode === 'WIP') {
        record.startedTime = new Date();
      }

      if (statusCode === 'COMPLETE') {
        record.completedTime = new Date();
      }

      let originRecord;

      switch (record.processCode) {
        case 'MP':
          originRecord = await this.entityManager.findOne(MonitorPlan, {
            where: { monPlanIdentifier: set.monPlanIdentifier },
          });
          break;
        case 'QA':
          if (record.testSumIdentifier) {
            originRecord = await this.entityManager.findOne(QaSuppData, {
              where: { testSumId: record.testSumIdentifier },
            });
          } else if (record.qaCertEventIdentifier) {
            originRecord = await this.entityManager.findOne(QaCertEvent, {
              where: {
                qaCertEventIdentifier: record.qaCertEventIdentifier,
              },
            });
          } else {
            originRecord = await this.entityManager.findOne(QaTee, {
              where: {
                testExtensionExemptionIdentifier:
                record.testExtensionExemptionIdentifier,
              },
            });
          }
          break;
        case 'EM':
          originRecord = await this.entityManager.findOne(EmissionEvaluation, {
            where: {
              monPlanIdentifier: set.monPlanIdentifier,
              rptPeriodIdentifier: record.rptPeriodIdentifier,
            },
          });

          if (originRecordCode === 'UPDATED') {
            await this.entityManager.query(
              `UPDATE camdecmpsaux.em_submission_access
               SET em_status_cd = $1, sub_availability_cd = $2
               WHERE mon_plan_id = $3
                 AND rpt_period_id = $4
                 AND access_begin_date = (SELECT MAX(access_begin_date)
                                          FROM camdecmpsaux.em_submission_access
                                          WHERE mon_plan_id = $3 AND rpt_period_id = $4);`,
              [
                'RECVD',
                'UPDATED',
                set.monPlanIdentifier,
                record.rptPeriodIdentifier,
              ],
            );
          }
          break;
        case 'MATS':
          originRecord = await this.entityManager.findOne(MatsBulkFile, {
            where: { id: record.matsBulkFileId },
          });
          break;
      }

      if (originRecord) {
        originRecord.submissionIdentifier = record.submissionIdentifier;
        originRecord.submissionAvailabilityCode = originRecordCode;
        await this.entityManager.save(originRecord);
      }
      await this.entityManager.save(record);
    }
  }

  public async getFacilityByFacIdentifier(facIdentifier: number): Promise<Plant> {
    const facility: Plant = await this.entityManager.findOneBy(Plant, {
      facIdentifier: facIdentifier,
    });

    if (!facility) {
      throw new Error(`Facility not found for facIdentifier: ${facIdentifier}`);
    }

    return facility;
  }

  public async getFormattedDateTime(date: Date = new Date()): Promise<string> {
    return date.toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    });
  }

}
