import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DataSource, EntityManager } from 'typeorm';
import { Logger } from '@us-epa-camd/easey-common/logger';

import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationErrorHandlerService } from './evaluation-error-handler.service';
import { MailEvalService } from '../mail/mail-eval.service';
import { EvaluationSetHelperService } from './evaluation-set-helper.service';
import { EvaluationDTO } from '../dto/evaluation.dto';

jest.mock('./evaluation.service');
jest.mock('./evaluation-error-handler.service');
jest.mock('../mail/mail-eval.service');
jest.mock('./evaluation-set-helper.service');

describe('-- Evaluation Controller --', () => {
  let controller: EvaluationController;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [EvaluationController],
      providers: [
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: EntityManager,
          useValue: {},
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
        EvaluationService,
        ConfigService,
        EvaluationErrorHandlerService,
        MailEvalService,
        EvaluationSetHelperService,
      ],
    }).compile();

    controller = module.get(EvaluationController);
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();
  });

  it('evaluate', async () => {
    const dtoParams = new EvaluationDTO();

    expect(async () => {
      await controller.evaluate(dtoParams);
    }).not.toThrowError();
  });
});
