import { Test } from '@nestjs/testing';
import { EntityManager, SelectQueryBuilder } from 'typeorm';

import { ErrorSuppressionsParamsDTO } from '../dto/error-suppressions.params.dto';
import { ErrorSuppressionsRepository } from './error-suppressions.repository';
import { QueryBuilderHelper } from '../utilities/query-builder.helper';

jest.mock('../utilities/query-builder.helper');

const mockQueryBuilder = () => ({
  andWhere: jest.fn(),
  getMany: jest.fn(),
  select: jest.fn(),
  addOrderBy: jest.fn(),
  leftJoin: jest.fn(),
});

let filters = new ErrorSuppressionsParamsDTO();
filters.checkTypeCode = 'HOURAGG';
filters.checkNumber = 7;
filters.checkResult = 'E';
filters.severityCode = 'NONE';
filters.orisCode = 3;
filters.locations = ['1', '2'];
filters.reasonCode = 'BUG';
filters.addDateAfter = '2019 Q1';
filters.addDateBefore = '2019 Q2';
filters.active = true;

describe('ErrorSuppressionsRepository', () => {
  let repository: ErrorSuppressionsRepository;
  let queryBuilder: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EntityManager,
        ErrorSuppressionsRepository,
        {
          provide: SelectQueryBuilder,
          useFactory: mockQueryBuilder,
        },
      ],
    }).compile();

    repository = module.get(ErrorSuppressionsRepository);
    queryBuilder = module.get(SelectQueryBuilder);

    QueryBuilderHelper.addDateAfter = jest.fn().mockReturnValue(queryBuilder);

    QueryBuilderHelper.addDateBefore = jest.fn().mockReturnValue(queryBuilder);

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.leftJoin.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.addOrderBy.mockReturnValue(queryBuilder);
    queryBuilder.getMany.mockReturnValue('mockErrorSuppressions');

    repository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
  });

  describe('getErrorSuppressions', () => {
    it('gets Error Suppressions from the repository with filters', async () => {
      const result = await repository.getErrorSuppressions(filters);
      expect(queryBuilder.getMany).toHaveBeenCalled();
      expect(result).toEqual('mockErrorSuppressions');
    });
  });
});
