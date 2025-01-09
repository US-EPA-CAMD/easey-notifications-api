import { EntityManager, In } from 'typeorm';
import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
import { EvaluationSetHelperService } from './evaluation-set-helper.service';
import { EvaluationErrorHandlerService } from './evaluation-error-handler.service';

@Injectable()
export class EvaluationService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,

    @Inject(forwardRef(() => EvaluationErrorHandlerService))
    private readonly errorHandlerService: EvaluationErrorHandlerService,
    private readonly evaluationSetHelper: EvaluationSetHelperService,
  ) {}

  async queueRecord(
    userId: string,
    userEmail: string,
    item: EvaluationItem,
    entityManager: EntityManager,
    queueingStages: { action: string; dateTime: string }[],
  ): Promise<void> {
    const evaluationSet = new EvaluationSet();
    let currentEvaluationQueue: Evaluation | null = null;
    this.logger.log(
      `Queueing evaluation record. evaluationSet: ${evaluationSet}, MonPlanId: ${
        item?.monPlanId || 'N/A'
      }, UserId: ${userId || 'N/A'}`,
    );
    try {
      const currentTime = new Date();
      const evalSetId = uuidv4();

      evaluationSet.evaluationSetIdentifier = evalSetId;
      evaluationSet.monPlanIdentifier = item.monPlanId;
      evaluationSet.userIdentifier = userId;
      evaluationSet.userEmail = userEmail;
      evaluationSet.queuedTime = currentTime;

      // Push queueing stage here
      queueingStages.push({
        action: 'EVAL_SET_ID_ASSIGNED',
        dateTime:
          (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
      });

      const locations = await entityManager.query(
        `SELECT camdecmpswks.get_mp_location_list($1);`,
        [item.monPlanId],
      );

      evaluationSet.configuration = locations[0]['get_mp_location_list'];

      const mp: MonitorPlan = await entityManager.findOneBy(MonitorPlan, {
        monPlanIdentifier: item.monPlanId,
      });

      if (!mp) {
        throw new Error(`Monitor Plan not found for ID: ${item.monPlanId}`);
      }

      const facility: Plant = await entityManager.findOneBy(Plant, {
        facIdentifier: mp.facIdentifier,
      });

      if (!facility) {
        throw new Error(
          `Facility not found for facIdentifier: ${mp.facIdentifier}`,
        );
      }

      evaluationSet.orisCode = facility.orisCode;
      evaluationSet.facIdentifier = facility.facIdentifier;
      evaluationSet.facName = facility.facilityName;

      await entityManager.save(EvaluationSet, evaluationSet);

      // Push queueing stage here
      queueingStages.push({
        action: 'EVAL_SET_SAVED',
        dateTime:
          (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
      });

      if (item.submitMonPlan === true) {
        this.logger.log(
          `Creating a monitoring plan evaluation record. evaluationSet: ${evaluationSet}, MonPlanId: ${
            item?.monPlanId || 'N/A'
          }`,
        );

        // Create monitor plan queue record
        mp.evalStatusCode = 'INQ';

        const mpRecord = new Evaluation();
        currentEvaluationQueue = mpRecord; // Keep reference for error handling
        mpRecord.evaluationSetIdentifier = evalSetId;
        mpRecord.processCode = 'MP';
        mpRecord.statusCode = 'QUEUED';
        mpRecord.queuedTime = currentTime;

        await entityManager.save(mpRecord);
        await entityManager.save(mp);

        // Push queueing stage here
        queueingStages.push({
          action: 'MP_QUEUED',
          dateTime:
            (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
        });
      }

      const testSumsOrderedList = await entityManager
        .getRepository(TestSummary)
        .createQueryBuilder('ts')
        .where({ testSumIdentifier: In(item.testSumIds) })
        .orderBy(
          `(case when ts.test_type_cd='RATA' then 1 when ts.test_type_cd='F2LREF' then 2 when ts.test_type_cd='F2LCHK' then 3 when ts.test_type_cd='FFACC' then 4 when ts.test_type_cd='FFACCTT' then 4 when ts.test_type_cd='PEI' then 4 when ts.test_type_cd='FF2LBAS' then 5 when ts.test_type_cd='FF2LTST' then 6 else null end)`,
        )
        .getMany();

      this.logger.log(
        `Queueing ${testSumsOrderedList?.length} test summary records.`,
      );

      if (testSumsOrderedList?.length) {
        for (const testSummary of testSumsOrderedList) {
          testSummary.evalStatusCode = 'INQ';
          const tsRecord = new Evaluation();
          currentEvaluationQueue = tsRecord; // Keep reference for error handling
          tsRecord.evaluationSetIdentifier = evalSetId;
          tsRecord.processCode = 'QA';
          tsRecord.statusCode =
            item.submitMonPlan === false ? 'QUEUED' : 'PENDING';
          tsRecord.testSumIdentifier = testSummary.testSumIdentifier;
          tsRecord.queuedTime = currentTime;
          await entityManager.save(testSummary);
          await entityManager.save(tsRecord);

          // Push queueing stage here
          queueingStages.push({
            action: 'TEST_QUEUED',
            dateTime:
              (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
          });
        }
      }

      this.logger.log(`Queueing ${item?.qceIds?.length} QCE records.`);

      for (const id of item.qceIds) {
        const qce = await entityManager.findOneBy(QaCertEvent, {
          qaCertEventIdentifier: id,
        });
        qce.evalStatusCode = 'INQ';

        const qceRecord = new Evaluation();
        currentEvaluationQueue = qceRecord; // Keep reference for error handling
        qceRecord.evaluationSetIdentifier = evalSetId;
        qceRecord.processCode = 'QA';
        qceRecord.statusCode =
          item.submitMonPlan === false ? 'QUEUED' : 'PENDING';
        qceRecord.qaCertEventIdentifier = id;
        qceRecord.queuedTime = currentTime;

        await entityManager.save(qce);
        await entityManager.save(qceRecord);

        // Push queueing stage here
        queueingStages.push({
          action: 'QCE_QUEUED',
          dateTime:
            (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
        });
      }

      this.logger.log(`Queueing ${item?.teeIds?.length} TEE records.`);

      for (const id of item.teeIds) {
        const tee = await entityManager.findOneBy(QaTee, {
          testExtensionExemptionIdentifier: id,
        });
        tee.evalStatusCode = 'INQ';

        const teeRecord = new Evaluation();
        currentEvaluationQueue = teeRecord; // Keep reference for error handling
        teeRecord.evaluationSetIdentifier = evalSetId;
        teeRecord.processCode = 'QA';
        teeRecord.statusCode =
          item.submitMonPlan === false ? 'QUEUED' : 'PENDING';
        teeRecord.testExtensionExemptionIdentifier = id;
        teeRecord.queuedTime = currentTime;

        await entityManager.save(tee);
        await entityManager.save(teeRecord);

        // Push queueing stage here
        queueingStages.push({
          action: 'TEE_QUEUED',
          dateTime:
            (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
        });
      }

      this.logger.log(
        `Queueing emissions with ${item?.emissionsReportingPeriods?.length} reporting period(s).`,
      );

      for (const periodAbr of item.emissionsReportingPeriods) {
        const rp = await entityManager.findOneBy(ReportingPeriod, {
          periodAbbreviation: periodAbr,
        });

        const ee = await entityManager.findOneBy(EmissionEvaluation, {
          monPlanIdentifier: item.monPlanId,
          rptPeriodIdentifier: rp.rptPeriodIdentifier,
        });

        ee.evalStatusCode = 'INQ';

        const emissionRecord = new Evaluation();
        currentEvaluationQueue = emissionRecord; // Keep reference for error handling
        emissionRecord.evaluationSetIdentifier = evalSetId;
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

        await entityManager.save(ee);
        await entityManager.save(emissionRecord);

        // Push queueing stage here
        queueingStages.push({
          action: 'EM_QUEUED',
          dateTime:
            (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
        });
      }

      this.logger.log(
        `Successfully queued evaluation record. evalSetId: ${evalSetId}, MonPlanId: ${
          item?.monPlanId || 'N/A'
        }`,
      );
    } catch (e) {
      this.logger.error(
        `Failed to queue evaluation record. MonPlanId: ${
          item?.monPlanId || 'N/A'
        }, Error: ${e.message}`,
        e.stack,
      );
      this.logger.error(`Aborting transaction`);

      // Attach evaluationSet and currentEvaluationQueue to the error
      e.evaluationSet = evaluationSet;
      e.currentEvaluationQueue = currentEvaluationQueue;

      throw e; // Re-throw the exception to abort the transaction
    }
  }

  async queueEvaluationRecords(evaluationDTO: EvaluationDTO): Promise<void> {
    this.logger.log(
      `Starting to queue evaluation records. UserId: ${
        evaluationDTO?.userId || 'N/A'
      }, Items count: ${evaluationDTO?.items?.length || 0}`,
    );

    // Build evaluationStages array
    const queueingStages: { action: string; dateTime: string }[] = [];
    // Push queueing stage here
    queueingStages.push({
      action: 'QUEUEING_STARTED',
      dateTime:
        (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
    });

    const userId = evaluationDTO.userId;
    const userEmail = evaluationDTO.userEmail;
    const evaluationItems = evaluationDTO.items;

    try {
      // Wrap everything in a transaction to ensure that all records are queued or none are queued
      await this.entityManager.transaction(
        async (transactionalEntityManager) => {
          for (const item of evaluationItems) {
            await this.queueRecord(
              userId,
              userEmail,
              item,
              transactionalEntityManager, // Pass the transactional EntityManager
              queueingStages,
            );
          }
        },
      );

      // Push queueing stage here
      queueingStages.push({
        action: 'QUEUEING_COMPLETED',
        dateTime:
          (await this.evaluationSetHelper.getFormattedDateTime()) || 'N/A',
      });

      this.logger.log(
        `Finished queueing evaluation records for UserId: ${
          evaluationDTO?.userId || 'N/A'
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue evaluation records. UserId: ${
          evaluationDTO?.userId || 'N/A'
        }, Error: ${error.message}`,
        error.stack,
      );

      // Extract evaluationSet and evaluationQueue from the error
      const evaluationSet = error.evaluationSet;
      const currentEvaluationQueue = error.currentEvaluationQueue;

      // Call ErrorHandlerService to send failure email
      await this.errorHandlerService.handleQueueingError(
        evaluationSet,
        currentEvaluationQueue,
        queueingStages,
        userEmail,
        userId,
        error,
      );

      // Throw error to API caller
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to queue evaluation records',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
