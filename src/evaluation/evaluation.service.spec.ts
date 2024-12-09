import { Test } from '@nestjs/testing';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { EntityManager } from 'typeorm';

import { EvaluationDTO, EvaluationItem } from '../dto/evaluation.dto';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { Plant } from '../entities/plant.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { TestSummary } from '../entities/test-summary.entity';
import { EvaluationService } from './evaluation.service';
import { EvaluationSetHelperService } from './evaluation-set-helper.service';
import { EvaluationErrorHandlerService } from './evaluation-error-handler.service';
import { HttpStatus } from '@nestjs/common';

const dtoItem = new EvaluationItem();
dtoItem.monPlanId = 'mockMonPlanId';
dtoItem.submitMonPlan = true;
dtoItem.testSumIds = ['testSumId1', 'testSumId2'];
dtoItem.qceIds = ['qceId1'];
dtoItem.teeIds = ['teeId1'];
dtoItem.emissionsReportingPeriods = ['2020 Q1'];

const payloadDto = new EvaluationDTO();
payloadDto.userId = 'user123';
payloadDto.userEmail = 'user@example.com';
payloadDto.items = [dtoItem, dtoItem]; // Two items to test multiple iterations

describe('-- Evaluation Service --', () => {
  let service: EvaluationService;
  let mockedEntityManager: any;
  let mockQuery: jest.Mock;
  let mockFindOneBy: jest.Mock;
  let mockGetRepository: jest.Mock;
  let mockSave: jest.Mock;
  let evaluationSetHelper: EvaluationSetHelperService;
  let errorHandlerService: EvaluationErrorHandlerService;

  beforeAll(async () => {
    mockQuery = jest.fn();
    mockFindOneBy = jest.fn();
    mockGetRepository = jest.fn();
    mockSave = jest.fn();

    const transactionalEntityManager = {
      query: mockQuery,
      findOneBy: mockFindOneBy,
      getRepository: mockGetRepository,
      save: mockSave,
    };

    mockedEntityManager = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        await cb(transactionalEntityManager);
      }),
    };

    const mockedEvaluationSetHelperService = {
      getFormattedDateTime: jest
        .fn()
        .mockResolvedValue('01/01/2021 12:00:00 AM'),
    };

    const mockedEvaluationErrorHandlerService = {
      handleQueueingError: jest.fn(),
    };

    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        EvaluationService,
        {
          provide: EntityManager,
          useValue: mockedEntityManager,
        },
        {
          provide: EvaluationSetHelperService,
          useValue: mockedEvaluationSetHelperService,
        },
        {
          provide: EvaluationErrorHandlerService,
          useValue: mockedEvaluationErrorHandlerService,
        },
      ],
    }).compile();

    service = module.get(EvaluationService);
    evaluationSetHelper = module.get(EvaluationSetHelperService);
    errorHandlerService = module.get(EvaluationErrorHandlerService);
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  it('should execute a payload successfully and make the proper calls', async () => {
    // Set up the mocks

    // Mock for entityManager.query()
    mockQuery.mockResolvedValue([{ get_mp_location_list: 'Unit1, Unit2' }]);

    // Mock for entityManager.findOneBy()
    mockFindOneBy.mockImplementation((entity, criteria) => {
      if (entity === MonitorPlan) {
        const mp = new MonitorPlan();
        mp.facIdentifier = 1;
        mp.monPlanIdentifier = criteria.monPlanIdentifier;
        return mp;
      } else if (entity === Plant) {
        const plant = new Plant();
        plant.facilityName = 'Test Facility';
        plant.orisCode = 123;
        plant.facIdentifier = criteria.facIdentifier;
        return plant;
      } else if (entity === QaCertEvent) {
        const qce = new QaCertEvent();
        qce.qaCertEventIdentifier = criteria.qaCertEventIdentifier;
        return qce;
      } else if (entity === QaTee) {
        const tee = new QaTee();
        tee.testExtensionExemptionIdentifier =
          criteria.testExtensionExemptionIdentifier;
        return tee;
      } else if (entity === TestSummary) {
        const testSummary = new TestSummary();
        testSummary.testSumIdentifier = criteria.testSumIdentifier;
        return testSummary;
      } else if (entity === ReportingPeriod) {
        const rp = new ReportingPeriod();
        rp.periodAbbreviation = criteria.periodAbbreviation;
        rp.rptPeriodIdentifier = 1;
        return rp;
      } else if (entity === EmissionEvaluation) {
        const ee = new EmissionEvaluation();
        ee.monPlanIdentifier = criteria.monPlanIdentifier;
        ee.rptPeriodIdentifier = criteria.rptPeriodIdentifier;
        return ee;
      } else {
        return null;
      }
    });

    // Mock for entityManager.getRepository()
    mockGetRepository.mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            getMany: jest.fn().mockResolvedValue([
              new TestSummary(),
              new TestSummary(),
            ]),
          }),
        }),
      }),
    });

    // Mock for entityManager.save()
    mockSave.mockResolvedValue(undefined);

    // Mock for evaluationSetHelper.getFormattedDateTime()
    evaluationSetHelper.getFormattedDateTime = jest
      .fn()
      .mockResolvedValue('01/01/2021 12:00:00 AM');

    // Call the method under test
    await service.queueEvaluationRecords(payloadDto);

    // Verify that entityManager.transaction was called
    expect(mockedEntityManager.transaction).toHaveBeenCalled();

    // Verify that save was called the expected number of times
    // Each item results in multiple saves, adjust the number accordingly
    // For simplicity, let's assume each item results in 13 saves
    expect(mockSave).toHaveBeenCalledTimes(26);

    // Optionally, you can check that other methods were called with expected arguments
    // For example, check that getFormattedDateTime was called
    expect(evaluationSetHelper.getFormattedDateTime).toHaveBeenCalled();
  });

  it('should handle errors and call error handler', async () => {
    // Simulate an error in the transaction
    mockedEntityManager.transaction = jest
      .fn()
      .mockImplementation(async (cb) => {
        throw new Error('Transaction error');
      });

    // Mock error handler
    errorHandlerService.handleQueueingError = jest.fn();

    try {
      await service.queueEvaluationRecords(payloadDto);
    } catch (error) {
      // Expected exception
      expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.response.error).toBe('Failed to queue evaluation records');
      expect(error.response.message).toBe('Transaction error');
    }

    // Verify that error handler was called
    expect(errorHandlerService.handleQueueingError).toHaveBeenCalled();
  });
});
