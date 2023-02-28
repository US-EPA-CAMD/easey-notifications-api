import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { MassEvalParamsDTO } from '../dto/mass-eval-params.dto';
import { CreateMailDto } from '../dto/create-mail.dto';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

const mockMailService = () => ({
  sendEmail: jest.fn(),
  sendMassEvalEmail: jest.fn(),
});

describe('Mail Controller', () => {
  let controller: MailController;
  let service: MailService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule, HttpModule],
      controllers: [MailController],
      providers: [
        { provide: MailService, useFactory: mockMailService },
        ConfigService,
      ],
    }).compile();

    service = module.get(MailService);
    controller = module.get(MailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call the basic service', () => {
    controller.send(new CreateMailDto(), '');

    expect(service.sendEmail).toHaveBeenCalled();
  });

  it('should call the mass eval service', () => {
    controller.sendMassEval(new MassEvalParamsDTO());

    expect(service.sendMassEvalEmail).toHaveBeenCalled();
  });
});
