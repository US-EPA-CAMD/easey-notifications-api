import { Test } from '@nestjs/testing';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';

import { BulkFileService } from './bulk-file.service';
import { BulkFileController } from './bulk-file.controller';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BulkFileInputDTO } from '../dto/bulk_file_input.dto';
import { createMock } from '@golevelup/ts-jest';
import { Request } from 'express';
import {
  ApportionedEmissionsQuarterlyDTO,
  ApportionedEmissionsStateDTO,
  ProgramCodeDTO,
  TimePeriodDTO,
} from '../dto/bulk-file-mass-generation.dto';
import { MassBulkFileService } from './mass-bulk-file.service';

jest.mock('./bulk-file.service');
jest.mock('./mass-bulk-file.service');

describe('-- Bulk File Controller --', () => {
  let bulkFileController: BulkFileController;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule, HttpModule],
      controllers: [BulkFileController],
      providers: [ConfigService, BulkFileService, MassBulkFileService],
    }).compile();

    bulkFileController = module.get(BulkFileController);
  });

  it('should be defined', async () => {
    expect(bulkFileController).toBeDefined();
  });

  it('getBulkFiles', async () => {
    expect(async () => {
      await bulkFileController.getBulkFiles(
        createMock<Request>({
          res: { removeHeader: jest.fn(), setHeader: jest.fn() },
        }),
      );
    }).not.toThrowError();
  });

  it('addBulkFile', async () => {
    expect(async () => {
      await bulkFileController.addBulkFile(new BulkFileInputDTO());
    }).not.toThrowError();
  });

  it('massBulkFileState', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileState(
        new ApportionedEmissionsStateDTO(),
      );
    }).not.toThrowError();
  });

  it('massBulkFileQuarter', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileQuarter(
        new ApportionedEmissionsQuarterlyDTO(),
      );
    }).not.toThrowError();
  });

  it('massBulkFileFacility', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileFacility(new TimePeriodDTO());
    }).not.toThrowError();
  });

  it('massBulkFileEmissionsCompliance', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileEmissionsCompliance();
    }).not.toThrowError();
  });

  it('massBulkFileAllowanceHoldings', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileAllowanceHoldings(
        new ProgramCodeDTO(),
      );
    }).not.toThrowError();
  });

  it('massBulkFileAllowanceCompliance', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileAllowanceCompliance(
        new ProgramCodeDTO(),
      );
    }).not.toThrowError();
  });

  it('massBulkFileAllowanceTransactions', async () => {
    expect(async () => {
      await bulkFileController.massBulkFileAllowanceTransactions(
        new ProgramCodeDTO(),
      );
    }).not.toThrowError();
  });
});
