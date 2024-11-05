import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionEmailService } from './submission-email.service';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSetService } from '../dataset/dataset.service';
import { SubmissionFeedbackRecordService } from './submission-feedback-record.service';
import { SubmissionTemplateService } from './submission-template.service';
import { MailEvalService } from '../mail/mail-eval.service';
import { RecipientListService } from './recipient-list.service';
import { ErrorHandlerService } from './error-handler.service';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { SeverityCode } from '../entities/severity-code.entity';

describe('SubmissionEmailService', () => {
  let service: SubmissionEmailService;
  let entityManager: EntityManager;
  let configService: ConfigService;
  let errorHandlerService: ErrorHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        SubmissionEmailService,
        {
          provide: EntityManager,
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            query: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-value'),
          },
        },
        {
          provide: DataSetService,
          useValue: {
            getDataSet: jest.fn(),
          },
        },
        {
          provide: SubmissionFeedbackRecordService,
          useValue: {
            getSubmissionReceiptData: jest.fn(),
            generateSummaryTableForUnitStack: jest.fn(),
            generateQATable: jest.fn(),
            getDisplayDate: jest.fn(),
          },
        },
        {
          provide: SubmissionTemplateService,
          useValue: {
            renderTemplate: jest.fn(),
          },
        },
        {
          provide: MailEvalService,
          useValue: {
            buildEvalReports: jest.fn(),
          },
        },
        {
          provide: RecipientListService,
          useValue: {
            getEmailRecipients: jest.fn(),
          },
        },
        {
          provide: ErrorHandlerService,
          useValue: {
            handleError: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubmissionEmailService>(SubmissionEmailService);
    entityManager = module.get<EntityManager>(EntityManager);
    configService = module.get<ConfigService>(ConfigService);
    errorHandlerService = module.get<ErrorHandlerService>(ErrorHandlerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectFeedbackReportDataForEmail', () => {
    it('should collect feedback report data successfully', async () => {
      const set = new SubmissionSet();
      const submissionSetRecords = [new SubmissionQueue()];
      const severityCodes = [new SeverityCode()];
      const feedbackEmailData = {};
      const stages: { action: string; dateTime: string }[] = [];
      stages.push({ action: 'SUBMISSION_LOADED', dateTime: 'N/A' });
      stages.push({ action: 'SET_STATUS_WIP', dateTime: 'N/A' });

      (entityManager.find as jest.Mock).mockResolvedValueOnce(severityCodes);

      jest.spyOn(service, 'groupSubmissionRecords').mockReturnValue({
        'MP': { processCode: 'MP', records: submissionSetRecords },
        'qaCriticalRecords': { processCode: 'QA_CRITICAL', records: [] },
        'qaNonCriticalRecords': { processCode: 'QA_NON_CRITICAL', records: [] },
      });

      jest
        .spyOn(service as any, 'getSubmissionFeedbackEmailData')
        .mockResolvedValue(feedbackEmailData);

      const result = await service.collectFeedbackReportDataForEmail(set, submissionSetRecords, stages);

      expect(result).toContain(feedbackEmailData);
    });

  });
});
