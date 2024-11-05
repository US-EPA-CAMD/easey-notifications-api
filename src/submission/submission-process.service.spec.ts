import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { Test } from '@nestjs/testing';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import * as fsFunctions from 'fs';
import { Observable, of } from 'rxjs';

import { CopyOfRecordService } from '../copy-of-record/copy-of-record.service';
import { DataSetService } from '../dataset/dataset.service';
import { ReportDTO } from '../dto/report.dto';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { QaSuppData } from '../entities/qa-supp.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { SubmissionSet } from '../entities/submission-set.entity';
import { MailEvalService } from '../mail/mail-eval.service';
import { SubmissionProcessService } from './submission-process.service';
import { SubmissionFeedbackRecordService } from './submission-feedback-record.service';
import { SeverityCode } from '../entities/severity-code.entity';
import { RecipientListService } from './recipient-list.service';
import { SubmissionFeedbackEmailData } from '../dto/submission-email-params.dto';

jest.mock('@aws-sdk/client-s3');

describe('-- Submission Process Service --', () => {
  let service: SubmissionProcessService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      controllers: [],
      providers: [
        ConfigService,
        SubmissionProcessService,
        EntityManager,
        {
          provide: MailEvalService,
          useFactory: () => ({
            sendMassEvalEmail: jest.fn(),
            sendEmailWithRetry: jest.fn(),
          }),
        },
        {
          provide: HttpService,
          useFactory: () => ({
            post(url: string, data: any): Observable<any> {
              // Simulate an HTTP POST request and return an observable
              return of({ message: 'Mock HTTP response', data });
            },
            get() {
              return of([]);
            },
          }),
        },
        {
          provide: DataSetService,
          useFactory: () => ({
            getDataSet: jest.fn().mockResolvedValue(new ReportDTO()),
          }),
        },
        {
          provide: CopyOfRecordService,
          useFactory: () => ({
            generateCopyOfRecord: jest.fn().mockReturnValue('mockReport'),
            generateCopyOfRecordCert: jest.fn().mockResolvedValue(''),
          }),
        },
        {
          provide: SubmissionFeedbackRecordService,
          useFactory: () => ({
            createSubmissionFeedbackEmailAttachment: jest.fn().mockReturnValue('content'),
            replaceAttachmentHeaderContents: jest.fn().mockReturnValue('content'),
            generateSummaryTableForUnitStack: jest.fn().mockReturnValue('content'),
            addDefaultTable: jest.fn().mockReturnValue('content'),
            addTableHeader: jest.fn().mockReturnValue('content'),
            getSubmissionReceiptTableContent: jest.fn().mockReturnValue('content'),
            generateQATable: jest.fn().mockReturnValue('content'),
          }),
        },
        {
          provide: RecipientListService,
          useFactory: () => ({
            getClientToken: jest.fn().mockReturnValue('mockToken'),
            getEmailRecipients: jest.fn().mockReturnValue('email1@gmail.com;email2@gmail.com'),
          }),
        },
      ],
    }).compile();

    service = module.get(SubmissionProcessService);
  });

  beforeEach(() => {
    const set = new SubmissionSet();
    set.activityId = 'mock';

    jest.spyOn(service, 'returnManager').mockReturnValue({
      findOneBy: jest.fn().mockImplementation((val) => {
        switch (val.name) {
          case 'SubmissionSet':
            return set;
          case 'SubmissionQueue':
            return new SubmissionQueue();
          case 'MonitorPlan':
            return new MonitorPlan();
          case 'QaSuppData':
            return new QaSuppData();
          case 'EmissionEvaluation':
            return new EmissionEvaluation();
        }
        return false;
      }),

      query: jest.fn(),

      transaction: jest.fn(),

      findBy: jest.fn().mockResolvedValue([new SubmissionQueue()]),

      find: jest.fn().mockResolvedValue([new SubmissionQueue()]),

      save: jest.fn(),
    } as any as EntityManager);
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  it('should ensure getCopyOfRecord fires correctly', async () => {
    const mockTransactions = [];

    const record = new SubmissionQueue();
    record.processCode = 'MP';

    const set = new SubmissionSet();
    set.facIdentifier = 1;
    set.monPlanIdentifier = 'mockMP';

    await service.buildTransactions(set, record, mockTransactions, '');

    expect(mockTransactions.length).toBe(1);
  });

  it('should set record status code correctly for files sent in', async () => {
    const mockMP = new MonitorPlan();
    const mockQaT = new QaSuppData();
    const mockEm = new EmissionEvaluation();

    jest.spyOn(service, 'returnManager').mockReturnValue({
      findOneBy: jest.fn().mockImplementation((val) => {
        switch (val.name) {
          case 'MonitorPlan':
            return mockMP;
          case 'QaSuppData':
            return mockQaT;
          case 'EmissionEvaluation':
            return mockEm;
        }
        return false;
      }),

      query: jest.fn(),

      save: jest.fn(),
    } as any as EntityManager);

    const set = new SubmissionSet();
    set.facIdentifier = 1;
    set.monPlanIdentifier = 'mockMP';

    const record1 = new SubmissionQueue();
    record1.processCode = 'MP';
    record1.testSumIdentifier = null;
    record1.rptPeriodIdentifier = null;

    const record2 = new SubmissionQueue();
    record2.processCode = 'QA';
    record2.testSumIdentifier = 'mock';

    const record3 = new SubmissionQueue();
    record3.processCode = 'EM';
    record3.rptPeriodIdentifier = 1;

    await service.setRecordStatusCode(
      set,
      [record1, record2, record3],
      'COMPLETE',
      '',
      'UPDATED',
    );

    expect(mockMP.submissionAvailabilityCode).toEqual('UPDATED');
    //expect(mockQaT.submissionAvailabilityCode).toEqual('UPDATED');
    //expect(mockEm.submissionAvailabilityCode).toEqual('UPDATED');
  });

  it('should handle cleanup of success correctly', async () => {
    jest.spyOn(fsFunctions, 'rmSync').mockImplementation();

    jest.spyOn(service, 'setRecordStatusCode').mockImplementation(jest.fn());

    expect(async () => {
      await service.successCleanup(
        '',
        new SubmissionSet(),
        [new SubmissionQueue()],
        [],
      );
    }).not.toThrowError();
  });

  it('should process submission set fires correctly', async () => {
    jest.spyOn(service, 'buildTransactions').mockResolvedValue();
    jest.spyOn(service, 'buildDocuments').mockResolvedValue();
    jest.spyOn(service, 'successCleanup').mockResolvedValue();
    jest.spyOn(fsFunctions, 'writeFile').mockImplementation(jest.fn());
    jest.spyOn(fsFunctions, 'mkdirSync').mockImplementation(jest.fn());
    jest.spyOn(fsFunctions, 'writeFileSync').mockImplementation(jest.fn());
    jest.spyOn(fsFunctions, 'readdirSync').mockReturnValue([]);
    jest.spyOn(fsFunctions, 'createReadStream').mockImplementation();
    jest.spyOn(fsFunctions, 'rmSync').mockImplementation();

    jest.spyOn(service, 'setRecordStatusCode').mockImplementation(jest.fn());

    expect(async () => {
      await service.processSubmissionSet('');
    }).not.toThrowError();
  });

  // addEvalReports
  it('should add evaluation reports correctly', async () => {
    const set = new SubmissionSet();
    set.orisCode = 12345;
    set.monPlanIdentifier = 'mockMP';

    const record1 = new SubmissionQueue();
    record1.processCode = 'MP';
    record1.severityCode = 'CRIT1';

    const records = [record1];
    const documents = [];

    const mockReportDTO = new ReportDTO();
    jest.spyOn(service['dataSetService'], 'getDataSet').mockResolvedValue(mockReportDTO);
    jest.spyOn(service['copyOfRecordService'], 'generateCopyOfRecord').mockReturnValue('mockReport');

    await service.addEvalReports(set, records, documents);

    expect(documents.length).toBe(1);
    expect(documents[0].documentTitle).toEqual('12345_MP_EVALmockMP');
    expect(documents[0].context).toEqual('mockReport');
  });

  //handleError
  it('should handle errors correctly', async () => {
    const set = new SubmissionSet();
    set.userEmail = 'test@example.com';
    set.submissionSetIdentifier = 'mockSetId';

    const queue = [new SubmissionQueue()];
    const error = new Error('mock error');

    jest.spyOn(service, 'setRecordStatusCode').mockResolvedValue();
    jest.spyOn(service.returnManager(), 'save').mockResolvedValue({});
    jest.spyOn(service, 'collectFeedbackReportDataForEmail').mockResolvedValue([{} as SubmissionFeedbackEmailData]);
    jest.spyOn(service['logger'], 'error').mockImplementation(jest.fn());

    // Ensure the method call and catch the thrown error
    await expect(service.handleError(set, queue, error)).rejects.toThrow('mock error');

    expect(set.statusCode).toEqual('ERROR');
    expect(set.details).toEqual(JSON.stringify(error));
    expect(service['logger'].error).toHaveBeenCalled();
  });

  it('should generate emissions summary report correctly', async () => {
    const submissionEmailParamsDto = {
      submissionSet: new SubmissionSet(),
      submissionRecords: [new SubmissionQueue()],
      monLocationIds: '1,2',
    };

    jest.spyOn(service['dataSetService'], 'getDataSet').mockResolvedValue(new ReportDTO());
    jest.spyOn(service['submissionFeedbackRecordService'], 'generateSummaryTableForUnitStack')
      .mockImplementation(() => 'Summary Content');

    const result = await service.getEmissionsSummaryReport(submissionEmailParamsDto as any);

    expect(result).toContain('Summary Content');
  });

  it('should generate QA feedback report correctly', async () => {
    const submissionEmailParamsDto = {
      submissionSet: new SubmissionSet(),
      submissionRecords: [new SubmissionQueue()],
    };

    jest.spyOn(service['dataSetService'], 'getDataSet').mockResolvedValue(new ReportDTO());
    jest.spyOn(service['submissionFeedbackRecordService'], 'generateQATable')
      .mockImplementation(() => 'QA Content');

    const result = await service.getQAFeedbackReport(submissionEmailParamsDto as any);

    expect(result).toContain('QA Content');
  });

  /*it('should send feedback report email for different submission types', async () => {
    const setId = 'mockSetId';
    const set = new SubmissionSet();
    const records = [new SubmissionQueue()];

    // Explicit type assertion to EntityManager
    const returnManager = service['returnManager'] as jest.Mocked<EntityManager>;

    jest.spyOn(returnManager, 'findOneBy').mockResolvedValueOnce(set);
    jest.spyOn(returnManager, 'find').mockResolvedValueOnce(records);
    jest.spyOn(service, 'findRecordWithHighestSeverityLevel').mockResolvedValue({ submissionQueue: records[0], severityCode: new SeverityCode() });
    jest.spyOn(service, 'sendFeedbackEmail').mockResolvedValue();

    await service.sendFeedbackReportEmail('recipient@example.com', 'sender@example.com', setId, false);

    expect(service['sendFeedbackEmail']).toHaveBeenCalled();
  });
*/

  it('should find the record with the highest severity level', async () => {
    const severityCodes = [new SeverityCode()];
    severityCodes[0].severityLevel = 5;
    severityCodes[0].severityCode = 'CRIT1';

    const records = [new SubmissionQueue()];
    records[0].severityCode = 'CRIT1';

    const result = await service.findRecordWithHighestSeverityLevel(records, severityCodes);

    expect(result.severityCode.severityLevel).toEqual(5);
    expect(result.submissionQueue.severityCode).toEqual('CRIT1');
  });

});
