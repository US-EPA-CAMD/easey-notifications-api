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
import { ErrorHandlerService } from './error-handler.service';
import { SubmissionSetHelperService } from './submission-set-helper.service';

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
payloadDto.userId = 'testUser';
payloadDto.userEmail = 'test@example.com';
payloadDto.activityId = 'activity123';
payloadDto.hasCritErrors = false;

describe('-- Submission Service --', () => {
  let service: SubmissionService;
  let entityManagerMock: any;
  let errorHandlerServiceMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    errorHandlerServiceMock = {
      handleError: jest.fn(),
      handleQueueingError: jest.fn(),
      handleSubmissionProcessingError: jest.fn(),
      sendEmail: jest.fn(),
    };

    const queryMock = jest.fn().mockResolvedValue([
      {
        get_mp_location_list: 'Location1',
      },
    ]);

    const findOneByMock = jest.fn().mockImplementation((entity, criteria) => {
      switch (entity) {
        case MonitorPlan:
          const mp = new MonitorPlan();
          mp.facIdentifier = 1;
          return mp;
        case Plant:
          const p = new Plant();
          p.facilityName = 'testFacility';
          p.orisCode = 123;
          return p;
        case QaSuppData:
          return new QaSuppData();
        case QaCertEvent:
          return new QaCertEvent();
        case QaTee:
          return new QaTee();
        case ReportingPeriod:
          const rp = new ReportingPeriod();
          rp.rptPeriodIdentifier = 1;
          return rp;
        case CheckSession:
          const cs = new CheckSession();
          cs.severityCode = 'NONE';
          return cs;
        case EmissionEvaluation:
          return new EmissionEvaluation();
        case MatsBulkFile:
          return new MatsBulkFile();
        default:
          return null;
      }
    });

    const saveMock = jest.fn();

    const createQueryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(new CheckSession()),
    };

    const transactionMock = jest.fn(async (fn) => {
      return fn(entityManagerMock);
    });

    entityManagerMock = {
      query: queryMock,
      findOneBy: findOneByMock,
      save: saveMock,
      transaction: transactionMock,
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilderMock),
    };

    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      controllers: [],
      providers: [
        SubmissionService,
        {
          provide: EntityManager,
          useValue: entityManagerMock,
        },
        {
          provide: ErrorHandlerService,
          useValue: errorHandlerServiceMock,
        },
        {
          provide: SubmissionSetHelperService,
          useValue: {
            updateSubmissionSetStatus: jest.fn(),
            setRecordStatusCode: jest.fn(),
            getFormattedDateTime: jest.fn(),
          },
        },
        CombinedSubmissionsMap,
        EmissionsLastUpdatedMap,
      ],
    }).compile();

    service = module.get(SubmissionService);
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });
});
