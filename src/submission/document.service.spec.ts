import { Test, TestingModule } from '@nestjs/testing';
import { DocumentService } from './document.service';
import { DataSetService } from '../dataset/dataset.service';
import { CopyOfRecordService } from '../copy-of-record/copy-of-record.service';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EntityManager } from 'typeorm';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
  mkdirSync: jest.fn(),
}));

describe('DocumentService', () => {
  let service: DocumentService;
  let dataSetService: DataSetService;
  let copyOfRecordService: CopyOfRecordService;
  let httpService: HttpService;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        DocumentService,
        {
          provide: DataSetService,
          useValue: {
            getDataSet: jest.fn(),
          },
        },
        {
          provide: CopyOfRecordService,
          useValue: {
            generateCopyOfRecord: jest.fn(),
            generateCopyOfRecordCert: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-value'),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: EntityManager,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    dataSetService = module.get<DataSetService>(DataSetService);
    copyOfRecordService = module.get<CopyOfRecordService>(CopyOfRecordService);
    httpService = module.get<HttpService>(HttpService);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildDocuments', () => {
    it('should build documents successfully', async () => {
      const set = new SubmissionSet();
      const records = [new SubmissionQueue()];
      const folderPath = 'mock/folder/path';

      jest.spyOn(service, 'addEvalReports').mockResolvedValue();
      jest.spyOn(service, 'buildCopyOfRecords').mockResolvedValue();
      jest.spyOn(service, 'addCertificationStatements').mockResolvedValue();

      jest.spyOn(fs, 'writeFileSync').mockImplementation(jest.fn());

      const result = await service.buildDocumentsAndWriteToFile(set, records, folderPath);

      expect(service.addEvalReports).toHaveBeenCalledWith(set, records, expect.any(Array));
      expect(service.buildCopyOfRecords).toHaveBeenCalledWith(set, records, expect.any(Array));
      expect(service.addCertificationStatements).toHaveBeenCalledWith(set, expect.any(Array));
      expect(result).toBeDefined();
    });
  });
});
