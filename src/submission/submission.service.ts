import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { ErrorHandlerService } from './error-handler.service';
import { SubmissionSetHelperService } from './submission-set-helper.service';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,
    private readonly combinedSubmissionMap: CombinedSubmissionsMap,
    private readonly emissionsLastUpdatedMap: EmissionsLastUpdatedMap,
    private readonly errorHandlerService: ErrorHandlerService,
    private readonly submissionSetHelper: SubmissionSetHelperService,
  ) {}

  private async ensureRelatedInactivePlansSubmitted(monPlanId: string) {
    const mp = await this.returnManager().findOne(MonitorPlan, {
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
      (await this.returnManager().countBy(MonitorPlan, {
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

  private async queueRecord(
    userId: string,
    userEmail: string,
    activityId: string,
    hasCritErrors: boolean,
    evaluationItem: EvaluationItem,
    entityManager: EntityManager,
    queueingStages: { action: string; dateTime: string }[],
  ): Promise<void> {

    const submissionSet = new SubmissionSet();
    let currentSubmissionQueue: SubmissionQueue | null = null;

    try {
      const currentTime = new Date();
      const setId = uuidv4();

      this.logger.debug(`Queueing record. setId: ${setId}, MonPlanId: ${evaluationItem?.monPlanId || 'N/A'}, UserId: ${userId || 'N/A'}`,);

      submissionSet.hasCritErrors = hasCritErrors;
      submissionSet.activityId = activityId;
      submissionSet.submissionSetIdentifier = setId;
      submissionSet.monPlanIdentifier = evaluationItem.monPlanId;
      submissionSet.userIdentifier = userId;
      submissionSet.userEmail = userEmail;
      submissionSet.queuedTime = currentTime;
      submissionSet.statusCode = 'QUEUED';

      //Push queueing stage here
      queueingStages.push({ action: 'SET_ID_ASSIGNED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });

      const locations = await entityManager.query(
        `SELECT camdecmpswks.get_mp_location_list($1);`,
        [evaluationItem.monPlanId],
      );

      submissionSet.configuration = locations[0]['get_mp_location_list'];

      const mp: MonitorPlan = await entityManager.findOneBy(
        MonitorPlan,
        { monPlanIdentifier: evaluationItem.monPlanId },
      );

      if (!mp) {
        throw new Error(`Monitor Plan not found for monPlanId: ${evaluationItem.monPlanId}`);
      }

      const facility: Plant = await entityManager.findOneBy(Plant, {
        facIdentifier: mp.facIdentifier,
      });

      if (!facility) {
        throw new Error(`Facility not found for facIdentifier: ${mp.facIdentifier}`);
      }

      submissionSet.facIdentifier = facility.facIdentifier;
      submissionSet.orisCode = facility.orisCode;
      submissionSet.facName = facility.facilityName;

      await entityManager.save(SubmissionSet, submissionSet);

      //Push queueing stage here
      queueingStages.push({ action: 'SET_SAVED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });

      if (evaluationItem.submitMonPlan === true) {
        this.logger.debug(`Creating a monitoring plan record. setId: ${setId}, MonPlanId: ${evaluationItem?.monPlanId || 'N/A'}`,);
        //Create monitor plan queue record
        mp.submissionAvailabilityCode = 'PENDING';

        const mpRecord = new SubmissionQueue();
        currentSubmissionQueue = mpRecord; // Keep reference for error handling
        mpRecord.submissionSetIdentifier = setId;
        mpRecord.processCode = 'MP';
        mpRecord.statusCode = 'QUEUED';
        mpRecord.queuedTime = currentTime;

        const cs: CheckSession = await entityManager
          .createQueryBuilder(CheckSession, 'cs')
          .where('cs.monPlanId = :monPlanId', { monPlanId: evaluationItem.monPlanId })
          .andWhere('cs.processCode = :processCode', { processCode: 'MP' })
          .andWhere('cs.tesSumId IS NULL')
          .andWhere('cs.qaCertEventId IS NULL')
          .andWhere('cs.testExtensionExemptionId IS NULL')
          .andWhere('cs.rptPeriodId IS NULL')
          .getOne();

        this.logger.debug(`Retrieved severity code of ${cs?.severityCode} from CheckSession`,);
        mpRecord.severityCode = cs?.severityCode || 'NONE';

        await entityManager.save(mpRecord);
        await entityManager.save(mp);

        //Push queueing stage here
        queueingStages.push({ action: 'MP_QUEUED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });
      }

      this.logger.debug(`Queueing ${evaluationItem?.testSumIds?.length} test summary records.`,);
      for (const id of evaluationItem.testSumIds) {
        const ts: QaSuppData = await entityManager.findOneBy(
          QaSuppData,
          {
            testSumId: id,
          },
        );

        this.logger.debug(`Queueing test summary with ID ${id} ...`,);
        const tsRecord = new SubmissionQueue();
        currentSubmissionQueue = tsRecord; // Keep reference for error handling
        tsRecord.submissionSetIdentifier = setId;
        tsRecord.processCode = 'QA';
        tsRecord.statusCode = 'QUEUED';
        tsRecord.testSumIdentifier = id;
        tsRecord.queuedTime = currentTime;

        const cs: CheckSession = await entityManager.findOneBy(
          CheckSession,
          {
            tesSumId: id,
          },
        );

        tsRecord.severityCode = cs?.severityCode || 'NONE';
        await entityManager.save(tsRecord);

        if (ts) {
          ts.submissionAvailabilityCode = 'PENDING'; //TODO FIND SUPP RECORD CORRESPONDING
          await entityManager.save(ts);
        }

        //Push queueing stage here
        queueingStages.push({ action: 'TEST_QUEUED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });
      }

      this.logger.debug(`Queueing ${evaluationItem?.qceIds?.length} QCE records.`,);
      for (const id of evaluationItem.qceIds) {
        const qce: QaCertEvent = await entityManager.findOneBy(
          QaCertEvent,
          { qaCertEventIdentifier: id },
        );

        this.logger.debug(`Queueing QCE with ID ${id} ...`);
        const qceRecord = new SubmissionQueue();
        currentSubmissionQueue = qceRecord; // Keep reference for error handling
        qceRecord.submissionSetIdentifier = setId;
        qceRecord.processCode = 'QA';

        qceRecord.statusCode = 'QUEUED';

        qceRecord.qaCertEventIdentifier = id;
        qceRecord.queuedTime = currentTime;

        const cs: CheckSession = await entityManager.findOneBy(
          CheckSession,
          {
            qaCertEventId: id,
          },
        );

        this.logger.debug(`Queueing QCE with ID ${id} ...`,);
        qceRecord.severityCode = cs?.severityCode || 'NONE';
        await entityManager.save(qceRecord);
        if (qce) {
          qce.submissionAvailabilityCode = 'PENDING';
          await entityManager.save(qce);
        }
        //Push queueing stage here
        queueingStages.push({ action: 'QCE_QUEUED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });
      }

      this.logger.debug(`Queueing ${evaluationItem?.teeIds?.length} TEE records.`,);
      for (const id of evaluationItem.teeIds) {
        const tee: QaTee = await entityManager.findOneBy(QaTee, {
          testExtensionExemptionIdentifier: id,
        });

        this.logger.debug(`Queueing TEE with ID ${id} ...`,);
        const teeRecord = new SubmissionQueue();
        currentSubmissionQueue = teeRecord; // Keep reference for error handling
        teeRecord.submissionSetIdentifier = setId;
        teeRecord.processCode = 'QA';
        teeRecord.statusCode = 'QUEUED';

        teeRecord.testExtensionExemptionIdentifier = id;
        teeRecord.queuedTime = currentTime;

        const cs: CheckSession = await entityManager.findOneBy(
          CheckSession,
          {
            testExtensionExemptionId: id,
          },
        );

        teeRecord.severityCode = cs?.severityCode || 'NONE';
        await entityManager.save(teeRecord);
        if (tee) {
          tee.submissionAvailabilityCode = 'PENDING';
          await entityManager.save(tee);
        }

        //Push queueing stage here
        queueingStages.push({ action: 'TEE_QUEUED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });
      }

      this.logger.debug(`Queueing emissions with ${evaluationItem?.emissionsReportingPeriods?.length} reporting period(s).`,);
      for (const periodAbr of evaluationItem.emissionsReportingPeriods) {
        const rp = await entityManager.findOneBy(ReportingPeriod, {
          periodAbbreviation: periodAbr,
        });

        this.logger.debug(`Queueing EM with ID ${rp?.rptPeriodIdentifier} and monPlanId ${evaluationItem?.monPlanId} ...`,);
        const ee: EmissionEvaluation = await entityManager.findOneBy(
          EmissionEvaluation,
          {
            monPlanIdentifier: evaluationItem.monPlanId,
            rptPeriodIdentifier: rp.rptPeriodIdentifier,
          },
        );

        const emissionRecord = new SubmissionQueue();
        currentSubmissionQueue = emissionRecord; // Keep reference for error handling
        emissionRecord.submissionSetIdentifier = setId;
        emissionRecord.processCode = 'EM';

        emissionRecord.statusCode = 'QUEUED';

        emissionRecord.rptPeriodIdentifier = rp.rptPeriodIdentifier;
        emissionRecord.queuedTime = currentTime;

        const cs: CheckSession = await entityManager.findOneBy(
          CheckSession,
          {
            monPlanId: evaluationItem.monPlanId,
            rptPeriodId: rp.rptPeriodIdentifier,
          },
        );

        emissionRecord.severityCode = cs?.severityCode || 'NONE';

        await entityManager.save(emissionRecord);
        if (ee) {
          ee.submissionAvailabilityCode = 'PENDING';
          await entityManager.save(ee);
        }

        //Push queueing stage here
        queueingStages.push({ action: 'EM_QUEUED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });
      }

      this.logger.debug(`Queueing ${evaluationItem?.matsBulkFiles?.length} MATS records.`,);
      for (const matsId of evaluationItem.matsBulkFiles) {
        const mf = await entityManager.findOneBy(MatsBulkFile, {
          id: matsId,
        });

        this.logger.debug(`Queueing MATS with ID ${matsId} ...`,);
        const matsRecord = new SubmissionQueue();
        currentSubmissionQueue = matsRecord; // Keep reference for error handling
        matsRecord.submissionSetIdentifier = setId;
        matsRecord.processCode = 'MATS';

        matsRecord.statusCode = 'QUEUED';

        matsRecord.matsBulkFileId = matsId;
        matsRecord.queuedTime = currentTime;

        matsRecord.severityCode = 'NONE';


        await entityManager.save(matsRecord);
        if (mf) {
          mf.submissionAvailabilityCode = 'PENDING';
          await entityManager.save(mf);
        }

        //Push queueing stage here
        queueingStages.push({ action: 'MATS_QUEUED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });
      }

      this.logger.debug(`Successfully queued record. SetId: ${setId}, MonPlanId: ${evaluationItem?.monPlanId || 'N/A'}`,);

    } catch (e) {
      this.logger.error(`Failed to queue record. MonPlanId: ${evaluationItem?.monPlanId || 'N/A'}, Error: ${e.message}`,e.stack,);
      this.logger.error(`Aborting transaction`);

      // Attach submissionSet and currentSubmissionQueue to the error
      e.submissionSet = submissionSet;
      e.currentSubmissionQueue = currentSubmissionQueue;

      throw e; //throw the exception so that the transaction is aborted.
    }
  }

  async queueSubmissionRecords(submissionQueueParam: SubmissionQueueDTO): Promise<void> {
    this.logger.debug(
      `Starting to queue submission records. UserId: ${submissionQueueParam?.userId || 'N/A'}, activityId: ${submissionQueueParam?.activityId || 'N/A'},  Items count: ${submissionQueueParam?.items?.length || 0}`,
    );

    // Check to make sure the items are ready to be submitted.
    await Promise.all(
      submissionQueueParam.items.map(async (item) => {
        // Inactive plans must be submitted before active plans with common locations.
        await this.ensureRelatedInactivePlansSubmitted(item.monPlanId);
      }),
    );

    // Build submissionStages array
    const queueingStages: { action: string; dateTime: string }[] = [];
    //Push queueing stage here
    queueingStages.push({ action: 'QUEUEING_STARTED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });

    const userId = submissionQueueParam.userId;
    const userEmail = submissionQueueParam.userEmail;
    const activityId = submissionQueueParam.activityId;
    const hasCritErrors = submissionQueueParam.hasCritErrors;
    const evaluationItems = submissionQueueParam.items;

    try {

      //wrap everything in a transaction to ensure that all records are queued or none are queued
      await this.entityManager.transaction(async (transactionalEntityManager) => {
        for (const evaluationItem of evaluationItems) {
          await this.queueRecord(
            userId,
            userEmail,
            activityId,
            hasCritErrors,
            evaluationItem,
            transactionalEntityManager, // Pass the transactional EntityManager
            queueingStages,
          );
        }
      });

      //Push queueing stage here
      queueingStages.push({ action: 'QUEUEING_COMPLETED', dateTime: await this.submissionSetHelper.getFormattedDateTime()  || 'N/A' });

      this.logger.debug(`Finished queueing submission records for UserId: ${submissionQueueParam?.userId || 'N/A'}`,);
    } catch (error) {
      this.logger.error(`Failed to queue submission records. UserId: ${submissionQueueParam?.userId || 'N/A'}, Error: ${error.message}`,error.stack,);

      // Extract submissionSet and submissionQueue from the error
      const submissionSet = error.submissionSet;
      const currentSubmissionQueue = error.currentSubmissionQueue;

      // Call ErrorHandlerService to send failure email
      await this.errorHandlerService.handleQueueingError(
        submissionSet,
        currentSubmissionQueue,
        queueingStages,
        userEmail,
        userId,
        error,
      );

      // Throw error to API caller
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to queue submission records',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
