import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Logger } from '@us-epa-camd/easey-common/logger';

import { ProcessParamsDTO } from '../dto/process-params.dto';
import { SubmissionQueueDTO } from '../dto/submission-queue.dto';
import { CombinedSubmissionsMap } from '../maps/combined-submissions.map';
import { EmissionsLastUpdatedMap } from '../maps/emissions-last-updated.map';
import { SubmissionProcessService } from './submission-process.service';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';

jest.mock('./submission.service');
jest.mock('./submission-process.service');

describe('-- Submission Controller --', () => {
  let controller: SubmissionController;
  let logger: Logger;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [SubmissionController],
      providers: [
        {
          provide: DataSource,
          useValue: {},
        },
        SubmissionService,
        SubmissionProcessService,
        ConfigService,
        CombinedSubmissionsMap,
        EmissionsLastUpdatedMap,
        {
          provide: Logger,
          useValue: {
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SubmissionController);
    logger = module.get<Logger>(Logger);
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();
  });

  it('evaluate', async () => {
    const dtoParams = new SubmissionQueueDTO();

    expect(async () => {
      await controller.queue(dtoParams);
    }).not.toThrowError();
  });

  it('process', async () => {
    expect(async () => {
      await controller.process(new ProcessParamsDTO());
    }).not.toThrowError();
  });

  it('last-updated', async () => {
    expect(async () => {
      await controller.lastUpdated('');
    }).not.toThrowError();
  });
});
