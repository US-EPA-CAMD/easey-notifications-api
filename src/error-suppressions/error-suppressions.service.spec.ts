import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { ErrorSuppressionsService } from './error-suppressions.service';
import { ErrorSuppressionsRepository } from './error-suppressions.repository';
import { ErrorSuppressionsParamsDTO } from '../dto/error-suppressions.params.dto';
import { genErrorSuppressions } from '../../test/object-generators/error-suppressions';
import { ErrorSuppressionsDTO } from '../dto/error-suppressions.dto';
import { ErrorSuppressionsMap } from '../../src/maps/error-suppressions.map';

const mockRepository = () => ({
  getErrorSuppressions: jest.fn(),
});
const mockMap = () => ({
  many: jest.fn(),
});

describe('-- Error Suppressions Service --', () => {
  let service: ErrorSuppressionsService;
  let map: any;
  let repository: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        ConfigService,
        ErrorSuppressionsService,
        {
          provide: ErrorSuppressionsRepository,
          useFactory: mockRepository,
        },
        {
          provide: ErrorSuppressionsMap,
          useFactory: mockMap,
        },
      ],
    }).compile();

    service = module.get(ErrorSuppressionsService);
    repository = module.get(ErrorSuppressionsRepository);
    map = module.get(ErrorSuppressionsMap);
  });

  describe('getErrorSuppressions', () => {
    it('calls ErrorSuppressionsRepository.getErrorSuppressions() and gets all the error suppressions from the repository', async () => {
      const mockedValues = genErrorSuppressions<ErrorSuppressionsDTO>();
      map.many.mockReturnValue(mockedValues);
      let filters = new ErrorSuppressionsParamsDTO();
      let result = await service.getErrorSuppressions(filters);
      expect(result).toEqual(mockedValues);
    });
  });
});
