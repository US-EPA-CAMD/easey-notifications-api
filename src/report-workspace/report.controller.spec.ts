import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';

import { DataSetRepository } from '../dataset/dataset.repository';
import { DataSetService } from '../dataset/dataset.service';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { ReportDTO } from '../dto/report.dto';
import { ReportWorkspaceController } from './report.controller';

describe('-- Report Controller --', () => {
  let controller: ReportWorkspaceController;
  let service: DataSetService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule, HttpModule],
      controllers: [ReportWorkspaceController],
      providers: [
        ConfigService,
        DataSetService,
        DataSetRepository,
        EntityManager,
      ],
    }).compile();

    controller = module.get(ReportWorkspaceController);
    service = module.get(DataSetService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('* getReport', () => {
    it('should return a single Report', async () => {
      const expectedResult = new ReportDTO();
      const paramsDto = new ReportParamsDTO();
      jest.spyOn(service, 'getDataSet').mockResolvedValue(expectedResult);
      expect(await controller.getReport(paramsDto)).toBe(expectedResult);
    });
  });
});
