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

const dtoItem = new EvaluationItem();
dtoItem.monPlanId = 'mock';
dtoItem.submitMonPlan = true;
dtoItem.testSumIds = ['mock', 'mock'];
dtoItem.qceIds = ['mock'];
dtoItem.teeIds = ['mock'];
dtoItem.emissionsReportingPeriods = ['2020 Q1'];

const payloadDto = new EvaluationDTO();
payloadDto.items = [dtoItem, dtoItem];

describe('-- Evaluation Service --', () => {
  let service: EvaluationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      controllers: [],
      providers: [EntityManager, EvaluationService],
    }).compile();

    service = module.get(EvaluationService);
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  it('should execute a payload successfully and make the proper calls', async () => {
    const mockInsertion = jest.fn();

    jest.spyOn(service, 'returnManager').mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          unitid: 'mockName',
        },
      ]),
      getRepository: jest.fn().mockImplementation(() => {
        return {
          createQueryBuilder: jest.fn().mockImplementation(() => {
            return {
              where: jest.fn().mockImplementation(() => {
                return {
                  orderBy: jest.fn().mockImplementation(() => {
                    return { getMany: jest.fn().mockReturnValue([{},{}]) };
                  }),
                };
              }),
            };
          }),
        };
      }),

      findOneBy: jest.fn().mockImplementation((val) => {
        switch (val.name) {
          case 'MonitorPlan':
            const mp = new MonitorPlan();
            mp.facIdentifier = 1;
            return mp;
          case 'Plant':
            const p = new Plant();
            p.facilityName = 'test';
            p.orisCode = 1;
            return p;
          case 'TestSummary':
            return new TestSummary();
          case 'QaCertEvent':
            return new QaCertEvent();
          case 'QaTee':
            return new QaTee();
          case 'ReportingPeriod':
            const rp = new ReportingPeriod();
            rp.rptPeriodIdentifier = 1;
            return rp;
          case 'EmissionEvaluation':
            return new EmissionEvaluation();
        }
        return false;
      }),

      save: mockInsertion,
    } as any);

    await service.queueEvaluationRecords(payloadDto);

    expect(mockInsertion).toHaveBeenCalledTimes(26);
  });
});
