import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';

import { MonitorPlan } from '../entities/monitor-plan.entity';
import { EvaluationItem } from '../dto/evaluation.dto';
import { Plant } from '../entities/plant.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { MatsBulkFile } from '../entities/mats-bulk-file.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { SubmissionService } from './submission.service';
import { SubmissionQueueDTO } from '../dto/submission-queue.dto';
import { QaSuppData } from '../entities/qa-supp.entity';
import { CombinedSubmissionsMap } from '../maps/combined-submissions.map';
import { EmissionsLastUpdatedMap } from '../maps/emissions-last-updated.map';
import { CheckSession } from '../entities/check-session.entity';

const dtoItem = new EvaluationItem();
dtoItem.monPlanId = 'mock';
dtoItem.submitMonPlan = true;
dtoItem.testSumIds = ['mock', 'mock'];
dtoItem.qceIds = ['mock'];
dtoItem.teeIds = ['mock'];
dtoItem.emissionsReportingPeriods = ['2020 Q1'];
dtoItem.matsBulkFiles = [];

const payloadDto = new SubmissionQueueDTO();
payloadDto.items = [dtoItem, dtoItem];

describe('-- Submission Service --', () => {
  let service: SubmissionService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      controllers: [],
      providers: [
        SubmissionService,
        CombinedSubmissionsMap,
        EmissionsLastUpdatedMap,
        EntityManager,
      ],
    }).compile();

    service = module.get(SubmissionService);
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
          case 'QaSuppData':
            return new QaSuppData();
          case 'QaCertEvent':
            return new QaCertEvent();
          case 'QaTee':
            return new QaTee();
          case 'ReportingPeriod':
            const rp = new ReportingPeriod();
            rp.rptPeriodIdentifier = 1;
            return rp;
          case 'CheckSession':
            const cs = new CheckSession();
            return cs;
          case 'EmissionEvaluation':
            return new EmissionEvaluation();
          case 'MatsBulkFile':
            return new MatsBulkFile();
        }
        return false;
      }),

      save: mockInsertion,
    } as any as EntityManager);

    await service.queueSubmissionRecords(payloadDto);

    expect(mockInsertion).toHaveBeenCalledTimes(2);
  });
});
