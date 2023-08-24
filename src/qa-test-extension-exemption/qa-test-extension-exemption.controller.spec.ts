import { Test, TestingModule } from '@nestjs/testing';
import { QaTestExtensionExemptionController } from './qa-test-extension-exemption.controller';
import { QaTestExtensionExemptionService } from './qa-test-extension-exemption.service';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { ConfigService } from '@nestjs/config';
import { QaCertMaintParamsDto } from '../dto/qa-cert-maint-params.dto';
import { EntityManager } from 'typeorm';
import { CurrentUser } from '@us-epa-camd/easey-common/interfaces';
import { QaUpdateDto } from '../dto/qa-update.dto';
import { QaTeeMaintMap } from '../maps/qa-tee-maint.map';
import { QaTeeMaintViewDTO } from '../dto/qa-tee-maint-vw.dto';

describe('QaTestExtensionExemptionController', () => {
  let controller: QaTestExtensionExemptionController;
  let service: QaTestExtensionExemptionService;
  let updatePayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, LoggerModule],
      controllers: [QaTestExtensionExemptionController],
      providers: [
        QaTestExtensionExemptionService,
        ConfigService,
        EntityManager,
        QaTeeMaintMap,
      ],
    }).compile();

    controller = module.get<QaTestExtensionExemptionController>(
      QaTestExtensionExemptionController,
    );

    service = module.get<QaTestExtensionExemptionService>(
      QaTestExtensionExemptionService,
    );

    updatePayload = new QaUpdateDto();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return data for getQaTeeViewData controller method', async () => {
    jest.spyOn(service, 'getQaTeeViewData').mockResolvedValue([]);

    expect(
      await controller.getQaTeeViewData(new QaCertMaintParamsDto()),
    ).toEqual([]);
  });

  it('should return data for updateSubmissionStatus controller method', async () => {
    const record = new QaTeeMaintViewDTO();
    const user: CurrentUser = {
      userId: 'testUser',
      sessionId: '',
      expiration: '',
      clientIp: '',
      facilities: [],
      roles: [],
    };
    jest.spyOn(service, 'updateSubmissionStatus').mockResolvedValue(record);

    expect(
      await controller.updateSubmissionStatus('id', user, updatePayload),
    ).toEqual(record);
  });

  it('should return data for deleteQACertTeeData controller method', async () => {
    jest.spyOn(service, 'deleteQACertTeeData').mockResolvedValue('');

    expect(await controller.deleteQACertTeeData('id')).toEqual('');
  });
});
