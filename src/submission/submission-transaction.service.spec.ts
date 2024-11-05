import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionTransactionService } from './submission-transaction.service';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
  },
  writeFileSync: jest.fn(),
  createReadStream: jest.fn(),
}));

// Mock the AWS SDK S3Client and commands
jest.mock('@aws-sdk/client-s3', () => {
  class GetObjectCommand {
    public input: any;
    constructor(params: any) {
      this.input = params;
    }
  }
  class PutObjectCommand {
    public input: any;
    constructor(params: any) {
      this.input = params;
    }
  }
  const S3Client = jest.fn(() => ({
    send: jest.fn(),
  }));

  return {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
  };
});

describe('SubmissionTransactionService', () => {
  let service: SubmissionTransactionService;
  let entityManager: EntityManager;
  let configService: ConfigService;
  let S3ClientMock;
  let s3ClientInstanceMock;

  beforeEach(async () => {
    // Prevent the AWS SDK from attempting to load shared config files
    process.env.AWS_SDK_LOAD_CONFIG = '0';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';

    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        SubmissionTransactionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'matsConfig.importCredentials' || key === 'matsConfig.globalCredentials') {
                return {
                  accessKeyId: 'test',
                  secretAccessKey: 'test',
                };
              } else if (key === 'matsConfig.importRegion' || key === 'matsConfig.globalRegion') {
                return 'us-east-1';
              } else if (key === 'matsConfig.importBucket' || key === 'matsConfig.globalBucket') {
                return 'mock-bucket';
              }
              return 'mock-value';
            }),
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

    service = module.get<SubmissionTransactionService>(SubmissionTransactionService);
    entityManager = module.get<EntityManager>(EntityManager);
    configService = module.get<ConfigService>(ConfigService);

    // Access the mocked S3Client
    const { S3Client } = require('@aws-sdk/client-s3');
    s3ClientInstanceMock = {
      send: jest.fn(),
    };
    S3ClientMock = S3Client;
    S3ClientMock.mockImplementation(() => s3ClientInstanceMock);

    // Mock the send method based on command types
    s3ClientInstanceMock.send.mockImplementation((command) => {
      const commandName = command.constructor.name;
      if (commandName === 'GetObjectCommand') {
        return Promise.resolve({
          Body: {
            // Simulate the transformToByteArray method
            transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('file content')),
          },
        });
      } else if (commandName === 'PutObjectCommand') {
        return Promise.resolve({});
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up environment variables
    delete process.env.AWS_SDK_LOAD_CONFIG;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  describe('buildTransactions', () => {
    it('should build transactions for MP records', async () => {
      const set = new SubmissionSet();
      set.monPlanIdentifier = 'mockMonPlanId';
      const records = [
        Object.assign(new SubmissionQueue(), {
          processCode: 'MP',
        }),
      ];
      const folderPath = 'mock/folder/path';
      const transactions = [];

      await service.buildTransactions(set, records, folderPath, transactions);

      expect(transactions.length).toBe(1);
      expect(transactions[0].command).toContain('copy_monitor_plan_from_workspace_to_global');
    });

  });
});
