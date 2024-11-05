import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DataSource } from 'typeorm';

import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationDTO } from '../dto/evaluation.dto';

jest.mock('./evaluation.service');

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
        EvaluationService,
        ConfigService,
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
