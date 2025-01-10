import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { EmSubmissionAccessParamsDTO } from '../dto/em-submission-access.params.dto';
import { EmSubmissionAccessView } from '../entities/em-submission-access-vw.entity';

@Injectable()
export class EmSubmissionAccessViewRepository extends Repository<EmSubmissionAccessView> {
  constructor(entityManager: EntityManager) {
    super(EmSubmissionAccessView, entityManager);
  }

  async getEmSubmissionAccess(
    params: EmSubmissionAccessParamsDTO,
  ): Promise<EmSubmissionAccessView[]> {
    const { orisCode, monitorPlanId, year, quarter, status } = params;
    let query = this.createQueryBuilder('em').select([
      'em.id',
      'em.facilityId',
      'em.facilityName',
      'em.orisCode',
      'em.monitorPlanId',
      'em.state',
      'em.locations',
      'em.reportingPeriodId',
      'em.reportingFrequencyCode',
      'em.reportingPeriodAbbreviation',
      'em.openDate',
      'em.closeDate',
      'em.emissionStatusCode',
      'em.emissionStatusDescription',
      'em.submissionAvailabilityCode',
      'em.submissionAvailabilityDescription',
      'em.lastSubmissionId',
      'em.submissionTypeCode',
      'em.submissionTypeDescription',
      'em.severityLevel',
      'em.userid',
      'em.addDate',
      'em.updateDate',
      'em.year',
      'em.quarter',
      'em.resubExplanation',
    ]);

    if (orisCode) {
      query.andWhere('em.orisCode = :orisCode', {
        orisCode: orisCode,
      });
    }

    if (monitorPlanId) {
      query.andWhere('em.monitorPlanId = :monitorPlanId', {
        monitorPlanId: monitorPlanId,
      });
    }

    if (year) {
      query.andWhere('em.year = :year', {
        year: year,
      });
    }

    if (quarter) {
      query.andWhere('em.quarter = :quarter', {
        quarter: quarter,
      });
    }

    if (status === 'OPEN') {
      query.andWhere(
        `(em.emissionStatusCode = 'APPRVD') AND (em.submissionAvailabilityCode IN ('REQUIRE', 'GRANTED') OR em.submissionAvailabilityCode IS NULL)`,
        { status: status },
      );
    }
    if (status === 'PENDING') {
      query.andWhere(
        `(em.emissionStatusCode = 'PENDING') AND (em.submissionAvailabilityCode IN ('REQUIRE', 'GRANTED') OR em.submissionAvailabilityCode IS NULL)`,
        { status: status },
      );
    }
    if (status === 'CLOSED') {
      query.andWhere(
        `(em.emissionStatusCode = 'RECVD' OR em.submissionAvailabilityCode IN ('DELETE','CRITERR', 'NOTSUB'))`,
        { status: status },
      );
    }

    query.andWhere(
      `(em.submissionAvailabilityCode != 'DELETE')`
    );
    return query.getMany();
  }
}
