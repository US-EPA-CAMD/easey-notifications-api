import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EvaluationSet } from '../entities/evaluation-set.entity';
import { Evaluation } from '../entities/evaluation.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { TestSummary } from '../entities/test-summary.entity';
import { Plant } from '../entities/plant.entity';
import { ConfigService } from '@nestjs/config';
import { ClientConfig } from '../entities/client-config.entity';

@Injectable()
export class EvaluationSetHelperService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly configService: ConfigService

  ) {}

  public async getECMPSClientConfig(): Promise<ClientConfig> {
    return await this.entityManager.findOne(ClientConfig, {
      where: { name: 'ecmps-ui' },
    });
  }

  async setRecordStatusCode(
    evaluationSet: EvaluationSet,
    records: Evaluation[],
    statusCode: string,
    note: string,
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
            where: { monPlanIdentifier: evaluationSet.monPlanIdentifier },
          });
          break;
        case 'QA':
          if (record.testSumIdentifier) {
            originRecord = await this.entityManager.findOne(TestSummary, {
              where: { testSumIdentifier: record.testSumIdentifier },
            });
          } else if (record.qaCertEventIdentifier) {
            originRecord = await this.entityManager.findOne(QaCertEvent, {
              where: {
                qaCertEventIdentifier: record.qaCertEventIdentifier,
              },
            });
          } else if (record.testExtensionExemptionIdentifier) {
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
              monPlanIdentifier: evaluationSet.monPlanIdentifier,
              rptPeriodIdentifier: record.rptPeriodIdentifier,
            },
          });
          break;
      }

      if (originRecord) {
        originRecord.evalStatusCode = "EVAL";
        await this.entityManager.save(originRecord);
      }
      await this.entityManager.save(record);
    }
  }

  public async getFacilityByFacIdentifier(
    facIdentifier: number,
  ): Promise<Plant> {
    const facility: Plant = await this.entityManager.findOne(Plant, {
      where: { facIdentifier: facIdentifier },
    });

    if (!facility) {
      throw new Error(
        `Facility not found for facIdentifier: ${facIdentifier}`,
      );
    }

    return facility;
  }

  public async getFormattedDateTime(date: Date = new Date()): Promise<string> {
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  public async getEvaluationType(processCode: string): Promise<string> {
    // Map process codes to evaluation types
    const evaluationTypeMap = {
      MP: 'Monitoring Plan Evaluation',
      QA: 'QA Evaluation',
      EM: 'Emissions Evaluation',
    };
    return evaluationTypeMap[processCode] || 'N/A';
  }
}
