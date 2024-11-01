import { HttpStatus, Injectable } from '@nestjs/common';
import { EaseyException } from '@us-epa-camd/easey-common/exceptions';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EntityManager, In, MoreThanOrEqual, Not } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { EvaluationItem } from '../dto/evaluation.dto';
import { SubmissionsLastUpdatedResponseDTO } from '../dto/submission-last-updated.dto';
import { SubmissionQueueDTO } from '../dto/submission-queue.dto';
import { CheckSession } from '../entities/check-session.entity';
import { CombinedSubmissions } from '../entities/combined-submissions.entity';
import { EmissionEvaluationGlobal } from '../entities/emission-evaluation-global.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { MatsBulkFile } from '../entities/mats-bulk-file.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { Plant } from '../entities/plant.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaSuppData } from '../entities/qa-supp.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { SubmissionSet } from '../entities/submission-set.entity';
import { CombinedSubmissionsMap } from '../maps/combined-submissions.map';
import { EmissionsLastUpdatedMap } from '../maps/emissions-last-updated.map';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,
    private readonly combinedSubmissionMap: CombinedSubmissionsMap,
    private readonly emissionsLastUpdatedMap: EmissionsLastUpdatedMap,
  ) {}

  private async ensureRelatedInactivePlansSubmitted(monPlanId: string) {
    const mp = await this.entityManager.findOne(MonitorPlan, {
      where: { monPlanIdentifier: monPlanId },
      relations: { locations: true },
    });
    if (!mp) {
      throw new EaseyException(
        new Error('Monitoring plan not found.'),
        HttpStatus.NOT_FOUND,
      );
    }

    const isActive = mp.endRPTPeriodIdentifier === null;

    const existsUnsubmittedInactive =
      (await this.entityManager.countBy(MonitorPlan, {
        facIdentifier: mp.facIdentifier,
        locations: {
          monLocIdentifier: In(mp.locations.map((loc) => loc.monLocIdentifier)),
        },
        monPlanIdentifier: Not(mp.monPlanIdentifier),
        submissionAvailabilityCode: Not('UPDATED'),
      })) > 0;

    if (isActive && existsUnsubmittedInactive) {
      throw new EaseyException(
        new Error(
          'Inactive monitoring plans for at least one of the locations in the current monitoring plan need to be submitted prior to submitting the current, active monitoring plan.',
        ),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  returnManager() {
    return this.entityManager;
  }

  async queueRecord(
    userId: string,
    userEmail: string,
    activityId: string,
    hasCritErrors: boolean,
    item: EvaluationItem,
  ): Promise<void> {
    try {
      const currentTime = new Date();
      const set_id = uuidv4();

      const submissionSet = new SubmissionSet();
      submissionSet.hasCritErrors = hasCritErrors;
      submissionSet.activityId = activityId;
      submissionSet.submissionSetIdentifier = set_id;
      submissionSet.monPlanIdentifier = item.monPlanId;
      submissionSet.userIdentifier = userId;
      submissionSet.userEmail = userEmail;
      submissionSet.submittedOn = currentTime;
      submissionSet.statusCode = 'QUEUED';

      const locations = await this.returnManager().query(
        `SELECT camdecmpswks.get_mp_location_list($1);`,
        [item.monPlanId],
      );

      submissionSet.configuration = locations[0]['get_mp_location_list'];

      const mp: MonitorPlan = await this.returnManager().findOneBy(
        MonitorPlan,
        { monPlanIdentifier: item.monPlanId },
      );

      const facility: Plant = await this.returnManager().findOneBy(Plant, {
        facIdentifier: mp.facIdentifier,
      });

      submissionSet.facIdentifier = facility.facIdentifier;
      submissionSet.orisCode = facility.orisCode;
      submissionSet.facName = facility.facilityName;

      await this.returnManager().save(SubmissionSet, submissionSet);

      if (item.submitMonPlan === true) {
        //Create monitor plan queue record
        mp.submissionAvailabilityCode = 'PENDING';

        const mpRecord = new SubmissionQueue();
        mpRecord.submissionSetIdentifier = set_id;
        mpRecord.processCode = 'MP';
        mpRecord.statusCode = 'QUEUED';
        mpRecord.submittedOn = currentTime;

        const cs: CheckSession = await this.returnManager()
          .createQueryBuilder(CheckSession, 'cs')
          .where('cs.monPlanId = :monPlanId', { monPlanId: item.monPlanId })
          .andWhere('cs.processCode = :processCode', { processCode: 'MP' })
          .andWhere('cs.tesSumId IS NULL')
          .andWhere('cs.qaCertEventId IS NULL')
          .andWhere('cs.testExtensionExemptionId IS NULL')
          .andWhere('cs.rptPeriodId IS NULL')
          .getOne();

        mpRecord.severityCode = cs?.severityCode || 'NONE';

        await this.returnManager().save(mpRecord);
        await this.returnManager().save(mp);
      }

      for (const id of item.testSumIds) {
        const ts: QaSuppData = await this.returnManager().findOneBy(
          QaSuppData,
          {
            testSumId: id,
          },
        );

        const tsRecord = new SubmissionQueue();
        tsRecord.submissionSetIdentifier = set_id;
        tsRecord.processCode = 'QA';
        tsRecord.statusCode = 'QUEUED';
        tsRecord.testSumIdentifier = id;
        tsRecord.submittedOn = currentTime;

        const cs: CheckSession = await this.returnManager().findOneBy(
          CheckSession,
          {
            tesSumId: id,
          },
        );

        tsRecord.severityCode = cs?.severityCode || 'NONE';
        await this.returnManager().save(tsRecord);

        if (ts) {
          ts.submissionAvailabilityCode = 'PENDING'; //TODO FIND SUPP RECORD CORRESPONDING
          await this.returnManager().save(ts);
        }
      }

      for (const id of item.qceIds) {
        const qce: QaCertEvent = await this.returnManager().findOneBy(
          QaCertEvent,
          { qaCertEventIdentifier: id },
        );

        const qceRecord = new SubmissionQueue();
        qceRecord.submissionSetIdentifier = set_id;
        qceRecord.processCode = 'QA';

        qceRecord.statusCode = 'QUEUED';

        qceRecord.qaCertEventIdentifier = id;
        qceRecord.submittedOn = currentTime;

        const cs: CheckSession = await this.returnManager().findOneBy(
          CheckSession,
          {
            qaCertEventId: id,
          },
        );

        qceRecord.severityCode = cs?.severityCode || 'NONE';
        await this.returnManager().save(qceRecord);
        if (qce) {
          qce.submissionAvailabilityCode = 'PENDING';
          await this.returnManager().save(qce);
        }
      }

      for (const id of item.teeIds) {
        const tee: QaTee = await this.returnManager().findOneBy(QaTee, {
          testExtensionExemptionIdentifier: id,
        });

        const teeRecord = new SubmissionQueue();
        teeRecord.submissionSetIdentifier = set_id;
        teeRecord.processCode = 'QA';
        teeRecord.statusCode = 'QUEUED';

        teeRecord.testExtensionExemptionIdentifier = id;
        teeRecord.submittedOn = currentTime;

        const cs: CheckSession = await this.returnManager().findOneBy(
          CheckSession,
          {
            testExtensionExemptionId: id,
          },
        );

        teeRecord.severityCode = cs?.severityCode || 'NONE';
        await this.returnManager().save(teeRecord);
        if (tee) {
          tee.submissionAvailabilityCode = 'PENDING';
          await this.returnManager().save(tee);
        }
      }

      for (const periodAbr of item.emissionsReportingPeriods) {
        const rp = await this.returnManager().findOneBy(ReportingPeriod, {
          periodAbbreviation: periodAbr,
        });

        const ee: EmissionEvaluation = await this.returnManager().findOneBy(
          EmissionEvaluation,
          {
            monPlanIdentifier: item.monPlanId,
            rptPeriodIdentifier: rp.rptPeriodIdentifier,
          },
        );

        const emissionRecord = new SubmissionQueue();
        emissionRecord.submissionSetIdentifier = set_id;
        emissionRecord.processCode = 'EM';

        emissionRecord.statusCode = 'QUEUED';

        emissionRecord.rptPeriodIdentifier = rp.rptPeriodIdentifier;
        emissionRecord.submittedOn = currentTime;

        const cs: CheckSession = await this.returnManager().findOneBy(
          CheckSession,
          {
            monPlanId: item.monPlanId,
            rptPeriodId: rp.rptPeriodIdentifier,
          },
        );

        emissionRecord.severityCode = cs?.severityCode || 'NONE';

        await this.returnManager().save(emissionRecord);
        if (ee) {
          ee.submissionAvailabilityCode = 'PENDING';
          await this.returnManager().save(ee);
        }
      }

      for (const matsId of item.matsBulkFiles) {
        const mf = await this.returnManager().findOneBy(MatsBulkFile, {
          id: matsId,
        });

        const matsRecord = new SubmissionQueue();
        matsRecord.submissionSetIdentifier = set_id;
        matsRecord.processCode = 'MATS';

        matsRecord.statusCode = 'QUEUED';

        matsRecord.matsBulkFileId = matsId;
        matsRecord.submittedOn = currentTime;

        matsRecord.severityCode = 'NONE';

        await this.returnManager().save(matsRecord);
        if (mf) {
          mf.submissionAvailabilityCode = 'PENDING';
          await this.returnManager().save(mf);
        }
      }
    } catch (e) {
      console.log(e);
      this.logger.log('Failed record queueing', {
        monPlanId: item.monPlanId,
      });
    }
  }

  async queueSubmissionRecords(params: SubmissionQueueDTO): Promise<void> {
    // Check to make sure the items are ready to be submitted.
    await Promise.all(
      params.items.map(async (item) => {
        // Inactive plans must be submitted before active plans with common locations.
        await this.ensureRelatedInactivePlansSubmitted(item.monPlanId);
      }),
    );

    let promises = [];

    for (const item of params.items) {
      promises.push(
        this.queueRecord(
          params.userId,
          params.userEmail,
          params.activityId,
          params.hasCritErrors,
          item,
        ),
      );
    }

    await Promise.all(promises);
  }

  async getLastUpdated(
    queryTime: string,
  ): Promise<SubmissionsLastUpdatedResponseDTO> {
    const dto = new SubmissionsLastUpdatedResponseDTO();

    const clock: Date = (await this.entityManager.query('SELECT now();'))[0]
      .now;

    dto.submissionLogs = await this.combinedSubmissionMap.many(
      await this.entityManager.findBy(CombinedSubmissions, {
        submissionEndStateStageTime: MoreThanOrEqual(new Date(queryTime)),
        statusCode: 'COMPLETE',
        processCode: 'EM',
      }),
    );

    dto.emissionReports = await this.emissionsLastUpdatedMap.many(
      await this.entityManager.findBy(EmissionEvaluationGlobal, {
        lastUpdated: MoreThanOrEqual(new Date(queryTime).toISOString()),
      }),
    );

    dto.mostRecentUpdateDate = clock;

    return dto;
  }
}
