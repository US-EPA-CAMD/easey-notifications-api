import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionSetHelperService } from './submission-set-helper.service';
import { EntityManager } from 'typeorm';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';

describe('SubmissionSetHelperService', () => {
  let service: SubmissionSetHelperService;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        SubmissionSetHelperService,
        {
          provide: EntityManager,
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubmissionSetHelperService>(SubmissionSetHelperService);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSubmissionSetStatus', () => {
    it('should update submission set status successfully', async () => {
      const submissionSet = new SubmissionSet();

      await service.updateSubmissionSetStatus(submissionSet, 'COMPLETE', 'Details');

      expect(submissionSet.statusCode).toBe('COMPLETE');
      expect(submissionSet.note).toBe('Details');
      expect(submissionSet.completedTime).toBeDefined();
      expect(entityManager.save).toHaveBeenCalledWith(submissionSet);
    });
  });

  describe('setRecordStatusCode', () => {
    it('should set record status code and update origin records', async () => {
      const set = new SubmissionSet();
      set.monPlanIdentifier = 'mockMonPlanId';

      const record = new SubmissionQueue();
      record.processCode = 'MP';

      const monitorPlan = new MonitorPlan();

      entityManager.findOne = jest.fn().mockResolvedValueOnce(monitorPlan);

      await service.setRecordStatusCode(set, [record], 'COMPLETE', 'Details', 'UPDATED');

      expect(record.statusCode).toBe('COMPLETE');
      expect(record.note).toBe('Details');
      expect(monitorPlan.submissionAvailabilityCode).toBe('UPDATED');
      expect(entityManager.save).toHaveBeenCalledTimes(2);
    });
  });
});
