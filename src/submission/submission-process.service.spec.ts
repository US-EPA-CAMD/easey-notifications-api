import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionProcessService } from './submission-process.service';
import { EntityManager } from 'typeorm';
import { LoggerModule, Logger } from '@us-epa-camd/easey-common/logger';
import { MailEvalService } from '../mail/mail-eval.service';
import { DocumentService } from './document.service';
import { SubmissionTransactionService } from './submission-transaction.service';
import { ErrorHandlerService } from './error-handler.service';
import { SubmissionSetHelperService } from './submission-set-helper.service';
import { SubmissionEmailService } from './submission-email.service';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import * as fsPromises from 'fs/promises';
import * as fs from 'node:fs';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
  mkdirSync: jest.fn(),
}));

describe('SubmissionProcessService', () => {
  let service: SubmissionProcessService;
  let entityManager: EntityManager;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        SubmissionProcessService,
        {
          provide: EntityManager,
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: MailEvalService,
          useValue: {
            sendEmailWithRetry: jest.fn(),
          },
        },
        {
          provide: DocumentService,
          useValue: {
            buildDocuments: jest.fn(),
            sendForSigning: jest.fn(),
            buildDocumentsAndWriteToFile: jest.fn(),
          },
        },
        {
          provide: SubmissionTransactionService,
          useValue: {
            buildTransactions: jest.fn(),
          },
        },
        {
          provide: ErrorHandlerService,
          useValue: {
            handleError: jest.fn(),
            handleQueueingError: jest.fn(),
            handleSubmissionProcessingError: jest.fn(),
            sendEmail: jest.fn(),
          },
        },
        {
          provide: SubmissionSetHelperService,
          useValue: {
            updateSubmissionSetStatus: jest.fn(),
            setRecordStatusCode: jest.fn(),
            getFormattedDateTime: jest.fn(),
          },
        },
        {
          provide: SubmissionEmailService,
          useValue: {
            collectFeedbackReportDataForEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubmissionProcessService>(SubmissionProcessService);
    entityManager = module.get<EntityManager>(EntityManager);
    logger = await module.resolve<Logger>(Logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processSubmissionSet', () => {
    it('should process a submission set successfully', async () => {
      const setId = 'test-set-id';
      const submissionSet = new SubmissionSet();
      submissionSet.submissionSetIdentifier = setId;
      submissionSet.hasCritErrors = false;

      const submissionSetRecords = [new SubmissionQueue()];

      jest.spyOn(entityManager, 'findOne').mockResolvedValueOnce(submissionSet);
      jest.spyOn(entityManager, 'find').mockResolvedValueOnce(submissionSetRecords);
      jest.spyOn(service['submissionSetHelper'], 'updateSubmissionSetStatus').mockResolvedValue();
      jest.spyOn(service['submissionSetHelper'], 'setRecordStatusCode').mockResolvedValue();
      jest.mock('uuidv4', () => ({ v4: () => 'mock-uuid' }));
      jest.spyOn(fsPromises, 'rm').mockResolvedValue();
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => 'mock-directory-path');
      jest.spyOn(fsPromises, 'rm').mockResolvedValue();
      jest.spyOn(service['transactionService'], 'buildTransactions').mockResolvedValue([]);
      jest.spyOn(service['documentService'], 'buildDocumentsAndWriteToFile').mockResolvedValue([]);
      jest.spyOn(service['documentService'], 'sendForSigning').mockResolvedValue();
      jest.spyOn(service['submissionEmailService'], 'collectFeedbackReportDataForEmail').mockResolvedValue([]);
      jest.spyOn(service, 'copyToOfficial').mockResolvedValue();

      await service.processSubmissionSet(setId);

      expect(entityManager.findOne).toHaveBeenCalledWith(SubmissionSet, {
        where: { submissionSetIdentifier: setId },
      });
      expect(entityManager.find).toHaveBeenCalledWith(SubmissionQueue, {
        where: { submissionSetIdentifier: setId },
      });
      expect(service['submissionSetHelper'].updateSubmissionSetStatus).toHaveBeenCalledWith(
        submissionSet,
        'WIP',
      );
      expect(service['submissionSetHelper'].setRecordStatusCode).toHaveBeenCalledWith(
        submissionSet,
        submissionSetRecords,
        'WIP',
        '',
        'PENDING',
      );
      expect(service['transactionService'].buildTransactions).toHaveBeenCalled();
      expect(service['documentService'].buildDocumentsAndWriteToFile).toHaveBeenCalled();
      expect(service['documentService'].sendForSigning).toHaveBeenCalled();
      expect(service['submissionEmailService'].collectFeedbackReportDataForEmail).toHaveBeenCalled();
      expect(service.copyToOfficial).toHaveBeenCalled();
      expect(service['submissionSetHelper'].updateSubmissionSetStatus).toHaveBeenCalledWith(
        submissionSet,
        'COMPLETE',
      );
    });

    it('should handle errors and call error handler', async () => {
      const setId = 'test-set-id';
      const submissionSet = new SubmissionSet();
      submissionSet.submissionSetIdentifier = setId;
      const submissionSetRecords = [new SubmissionQueue()];
      const error = new Error('Test Error');
      const stages: { action: string; dateTime: string }[] = [];
      stages.push({ action: 'SUBMISSION_LOADED', dateTime: 'N/A' });
      stages.push({ action: 'SET_STATUS_WIP', dateTime: 'N/A' });

        jest.spyOn(entityManager, 'findOne').mockResolvedValueOnce(submissionSet);
      jest.spyOn(entityManager, 'find').mockResolvedValueOnce(submissionSetRecords);
      jest.spyOn(service['submissionSetHelper'], 'updateSubmissionSetStatus').mockResolvedValue();
      jest.spyOn(service['submissionSetHelper'], 'setRecordStatusCode').mockResolvedValue();
      jest.mock('uuidv4', () => ({ v4: () => 'mock-uuid' }));
      jest.spyOn(fsPromises, 'rm').mockResolvedValue();
      jest.spyOn(service['transactionService'], 'buildTransactions').mockRejectedValue(error);
      jest.spyOn(service['errorHandlerService'], 'handleSubmissionProcessingError').mockResolvedValue();

      await service.processSubmissionSet(setId);

      expect(service['errorHandlerService'].handleSubmissionProcessingError).toHaveBeenCalledWith(
        submissionSet,
        submissionSetRecords,
        stages,
        error,
      );
    });
  });
});
