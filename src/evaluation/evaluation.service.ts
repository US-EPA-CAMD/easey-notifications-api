import { EntityManager, In } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EvaluationDTO, EvaluationItem } from '../dto/evaluation.dto';
import { v4 as uuidv4 } from 'uuid';
import { EvaluationSet } from '../entities/evaluation-set.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { Plant } from '../entities/plant.entity';
import { Evaluation } from '../entities/evaluation.entity';
import { TestSummary } from '../entities/test-summary.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';

@Injectable()
export class EvaluationService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,
  ) {}

  returnManager(): EntityManager {
    return this.entityManager;
  }

  async queueRecord(
    userId: string,
    userEmail: string,
    item: EvaluationItem,
  ): Promise<void> {
    try {
      const currentTime = new Date();
      const set_id = uuidv4();

      const evaluationSet = new EvaluationSet();
      evaluationSet.evaluationSetIdentifier = set_id;
      evaluationSet.monPlanIdentifier = item.monPlanId;
      evaluationSet.userIdentifier = userId;
      evaluationSet.userEmail = userEmail;
      evaluationSet.submittedOn = currentTime;

      const locations = await this.returnManager().query(
        `SELECT camdecmpswks.get_mp_location_list($1);`,
        [item.monPlanId],
      );

      evaluationSet.configuration = locations[0]['get_mp_location_list'];

      const mp: MonitorPlan = await this.returnManager().findOneBy(
        MonitorPlan,
        { monPlanIdentifier: item.monPlanId },
      );

      const facility: Plant = await this.returnManager().findOneBy(Plant, {
        facIdentifier: mp.facIdentifier,
      });

      evaluationSet.orisCode = facility.orisCode;
      evaluationSet.facIdentifier = facility.facIdentifier;
      evaluationSet.facName = facility.facilityName;

      await this.returnManager().save(EvaluationSet, evaluationSet);

      if (item.submitMonPlan === true) {
        //Create monitor plan queue record
        mp.evalStatusCode = 'INQ';

        const mpRecord = new Evaluation();
        mpRecord.evaluationSetIdentifier = set_id;
        mpRecord.processCode = 'MP';
        mpRecord.statusCode = 'QUEUED';
        mpRecord.queuedTime = currentTime;

        await this.returnManager().save(mpRecord);
        await this.returnManager().save(mp);
      }

      const testSumsOrderedList = await this.returnManager()
        .getRepository(TestSummary)
        .createQueryBuilder('ts')
        .where({ testSumIdentifier: In(item.testSumIds) })
        .orderBy(
          `(case when ts.test_type_cd='RATA' then 1 when ts.test_type_cd='F2LREF' then 2 when ts.test_type_cd='F2LCHK' then 3 when ts.test_type_cd='FFACC' then 4 when ts.test_type_cd='FFACCTT' then 4 when ts.test_type_cd='PEI' then 4 when ts.test_type_cd='FF2LBAS' then 5 when ts.test_type_cd='FF2LTST' then 6 else null end)`,
        )
        .getMany();

      if (testSumsOrderedList?.length) {
        for (const testSummary of testSumsOrderedList) {
          testSummary.evalStatusCode = 'INQ';
          const tsRecord = new Evaluation();
          tsRecord.evaluationSetIdentifier = set_id;
          tsRecord.processCode = 'QA';
          if (item.submitMonPlan === false) {
            tsRecord.statusCode = 'QUEUED';
          } else {
            tsRecord.statusCode = 'PENDING';
          }
          tsRecord.testSumIdentifier = testSummary.testSumIdentifier;
          tsRecord.queuedTime = currentTime;
          await this.returnManager().save(testSummary);
          await this.returnManager().save(tsRecord);
        }
      }

      for (const id of item.qceIds) {
        const qce = await this.returnManager().findOneBy(QaCertEvent, {
          qaCertEventIdentifier: id,
        });
        qce.evalStatusCode = 'INQ';

        const qceRecord = new Evaluation();
        qceRecord.evaluationSetIdentifier = set_id;
        qceRecord.processCode = 'QA';

        if (item.submitMonPlan === false) {
          qceRecord.statusCode = 'QUEUED';
        } else {
          qceRecord.statusCode = 'PENDING';
        }

        qceRecord.qaCertEventIdentifier = id;
        qceRecord.queuedTime = currentTime;

        await this.returnManager().save(qce);
        await this.returnManager().save(qceRecord);
      }

      for (const id of item.teeIds) {
        const tee = await this.returnManager().findOneBy(QaTee, {
          testExtensionExemptionIdentifier: id,
        });
        tee.evalStatusCode = 'INQ';

        const teeRecord = new Evaluation();
        teeRecord.evaluationSetIdentifier = set_id;
        teeRecord.processCode = 'QA';

        if (item.submitMonPlan === false) {
          teeRecord.statusCode = 'QUEUED';
        } else {
          teeRecord.statusCode = 'PENDING';
        }

        teeRecord.testExtensionExemptionIdentifier = id;
        teeRecord.queuedTime = currentTime;

        await this.returnManager().save(tee);
        await this.returnManager().save(teeRecord);
      }

      for (const periodAbr of item.emissionsReportingPeriods) {
        const rp = await this.returnManager().findOneBy(ReportingPeriod, {
          periodAbbreviation: periodAbr,
        });

        const ee = await this.returnManager().findOneBy(EmissionEvaluation, {
          monPlanIdentifier: item.monPlanId,
          rptPeriodIdentifier: rp.rptPeriodIdentifier,
        });

        ee.evalStatusCode = 'INQ';

        const emissionRecord = new Evaluation();
        emissionRecord.evaluationSetIdentifier = set_id;
        emissionRecord.processCode = 'EM';

        if (
          item.submitMonPlan === false &&
          item.testSumIds.length === 0 &&
          item.qceIds.length === 0 &&
          item.teeIds.length === 0
        ) {
          emissionRecord.statusCode = 'QUEUED';
        } else {
          emissionRecord.statusCode = 'PENDING';
        }
        emissionRecord.rptPeriodIdentifier = rp.rptPeriodIdentifier;
        emissionRecord.queuedTime = currentTime;

        await this.returnManager().save(ee);
        await this.returnManager().save(emissionRecord);
      }
    } catch (e) {
      console.error(e);
      this.logger.log('Failed record queueing', {
        monPlanId: item.monPlanId,
      });
    }
  }

  async queueEvaluationRecords(params: EvaluationDTO): Promise<void> {
    let promises = [];

    for (const item of params.items) {
      promises.push(this.queueRecord(params.userId, params.userEmail, item));
    }

    await Promise.all(promises);
  }
}
