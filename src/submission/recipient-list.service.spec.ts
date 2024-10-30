import { Test, TestingModule } from '@nestjs/testing';
import { RecipientListService } from './recipient-list.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EntityManager } from 'typeorm';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('RecipientListService', () => {
  let service: RecipientListService;
  let httpService: HttpService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipientListService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(), // Mocking this will allow us to control what configService.get returns
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(), // We'll mock this later
          },
        },
        {
          provide: EntityManager,
          useValue: {},
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecipientListService>(RecipientListService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('returnManager', () => {
    it('should return the entity manager', () => {
      const entityManager = service.returnManager();
      expect(entityManager).toBeDefined();
    });
  });

  describe('getClientToken', () => {
    it('should return a token when API call is successful', async () => {
      const mockToken = 'mockToken';
      const mockResponse: AxiosResponse<{ token: string }> = {
        data: { token: mockToken },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { method: 'post' as any },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      const result = await service.getClientToken();
      expect(result).toEqual(mockToken);
    });

    it('should return an empty string when API call returns no data', async () => {
      const mockResponse: AxiosResponse<null> = {
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { method: 'post' as any },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      const result = await service.getClientToken();
      expect(result).toEqual('');
    });

    it('should return an empty string and log error on exception', async () => {
      jest.spyOn(httpService, 'post').mockImplementation(() => {
        throw new Error('API Error');
      });

      const result = await service.getClientToken();
      expect(result).toEqual('');
    });
  });

  describe('getEmailRecipients', () => {
    it('should return a list of email recipients', async () => {
      // Mocking the configService.get call to return a valid recipientsListApi URL
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'app.recipientsListApi') {
          return 'http://mock-recipients-list-api.com';
        } else if (key === 'app.apiKey') {
          return 'mockApiKey';
        }
        return null;
      });

      const mockRecipients = [
        { emailAddressList: 'email1@example.com' },
        { emailAddressList: 'email2@example.com' },
      ];
      const mockResponse: AxiosResponse<typeof mockRecipients> = {
        data: mockRecipients,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { method: 'post' as any },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);
      jest.spyOn(service, 'getClientToken').mockResolvedValue('mockToken');

      const result = await service.getEmailRecipients('','','','','');
      expect(result).toEqual('email1@example.com;email2@example.com');
    });

    it('should return an empty string if client token is not obtained', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('http://mock-recipients-list-api.com');
      jest.spyOn(service, 'getClientToken').mockResolvedValue('');

      const result = await service.getEmailRecipients('','','','','');
      expect(result).toEqual('');
    });

    it('should return an empty string if API response format is invalid', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('http://mock-recipients-list-api.com');
      const mockResponse: AxiosResponse<{}> = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { method: 'post' as any },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);
      jest.spyOn(service, 'getClientToken').mockResolvedValue('mockToken');

      const result = await service.getEmailRecipients('','','','','');
      expect(result).toEqual('');
    });

    it('should return an empty string and log error on exception', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('http://mock-recipients-list-api.com');
      jest.spyOn(service, 'getClientToken').mockResolvedValue('mockToken');
      jest.spyOn(httpService, 'post').mockImplementation(() => {
        throw new Error('API Error With Logging');
      });

      const result = await service.getEmailRecipients('','','','','');
      expect(result).toEqual('');
    });
  });
});
