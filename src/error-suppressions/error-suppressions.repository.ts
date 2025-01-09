import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';

import { EsSpec } from '../entities/es-spec.entity';
import { ErrorSuppressionsParamsDTO } from '../dto/error-suppressions.params.dto';
import { QueryBuilderHelper } from '../utilities/query-builder.helper';

@Injectable()
export class ErrorSuppressionsRepository extends Repository<EsSpec> {
  constructor(entityManager: EntityManager) {
    super(EsSpec, entityManager);
  }

  async getErrorSuppressions(
    params: ErrorSuppressionsParamsDTO,
  ): Promise<EsSpec[]> {
    const {
      checkTypeCode,
      checkNumber,
      checkResult,
      severityCode,
      orisCode,
      locations,
      reasonCode,
      beginDateHrQtr,
      endDateHrQtr,
      active,
    } = params;
    let query = this.createQueryBuilder('es')
      .select([
        'es.id',
        'es.checkCatalogResultId',
        'cc.checkTypeCode',
        'cc.checkNumber',
        'ccr.checkResult',
        'es.severityCode',
        'es.facilityId',
        'p.orisCode',
        'p.facilityName',
        'es.locations',
        'es.matchDataTypeCode',
        'es.matchDataValue',
        'es.matchTimeTypeCode',
        'es.matchTimeBeginValue',
        'es.matchTimeEndValue',
        'es.matchHistoricalIndicator',
        'es.reasonCode',
        'es.note',
        'es.active',
        'es.userId',
        'es.addDate',
        'es.updateDate',
      ])
      .leftJoin('es.checkCatalogResult', 'ccr')
      .leftJoin('es.plant', 'p')
      .leftJoin('ccr.checkCatalog', 'cc');

    if (checkTypeCode) {
      query.andWhere('UPPER(cc.checkTypeCode) = :checkTypeCode', {
        checkTypeCode: checkTypeCode.toUpperCase(),
      });
    }
    if (checkNumber) {
      query.andWhere('cc.checkNumber = :checkNumber', {
        checkNumber: checkNumber,
      });
    }
    if (checkResult) {
      query.andWhere('UPPER(ccr.checkResult) = :checkResult', {
        checkResult: checkResult.toUpperCase(),
      });
    }
    if (severityCode) {
      query.andWhere('UPPER(es.severityCode) = :severityCode', {
        severityCode: severityCode.toUpperCase(),
      });
    }
    if (orisCode) {
      query.andWhere('p.orisCode = :orisCode', {
        orisCode,
      });
    }
    if (locations) {
      query.andWhere(
        `string_to_array(es.locations, ',') && string_to_array(:locations, ',')`,
        { locations: locations },
      );
    }
    if (reasonCode) {
      query.andWhere('UPPER(es.reasonCode) = :reasonCode', {
        reasonCode: reasonCode.toUpperCase(),
      });
    }
    if (beginDateHrQtr) {
      query = QueryBuilderHelper.beginDateHrQtr(query, beginDateHrQtr);
    }
    if (endDateHrQtr) {
      query = QueryBuilderHelper.endDateHrQtr(query, endDateHrQtr);
    }

    if (String(active) === String(true)) {
      query.andWhere('es.active = 1', {
        active: active,
      });
    } else if (String(active) === String(false)) {
      query.andWhere('es.active = 0', {
        active: active,
      });
    }
    query.addOrderBy('es.id');
    return query.getMany();
  }
}
