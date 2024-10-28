import { Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import * as https from 'https';


@Injectable()
export class RecipientListService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,
  ) {}

  returnManager() {
    return this.entityManager;
  }

  async getClientToken(): Promise<string> {
    this.logger.debug('getClientToken ...');

    //Construct the URL
    const url =`${this.configService.get<string>('app.authApi.uri')}/tokens/client`;
    this.logger.debug('using authApi: ' + url);

    //Construct the headers
    const headers = {
      "x-api-key": this.configService.get<string>('app.apiKey'),
    };

    //Construct the body
    const body = {
      clientId: this.configService.get<string>('app.clientId'),
      clientSecret: this.configService.get<string>('app.clientSecret')
    };

    this.logger.debug('Calling auth-api token validation API: ' +  url);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(url, body, { headers }),
      );

      if (!response.data) {
        this.logger.error('Invalid response from auth-api token validation API');
        return '';
      }

      return response.data.token;
    } catch (error) {
      this.logger.error('Error occurred during the API call to auth-api token validation API', error);
      return '';
    }
  }

  async getEmailRecipients(
    emailType: string = 'SUBMISSIONCONFIRMATION',
    plantId: number = 0,
    userId: string = 'defaultUserId',
    submissionType?: string,
    isMats: boolean = false,
  ): Promise<string> {

    this.logger.debug('getEmailRecipients with params', { emailType, plantId, userId, submissionType, isMats });

    const recipientsListApi = this.configService.get<string>('app.recipientsListApi');
    if (!recipientsListApi) {
      this.logger.error('recipientsListApi is not configured');
      return '';
    }

    const url = `${recipientsListApi}/api/auth-mgmt/emailRecipients`
    this.logger.debug('using recipientsListApi: ' + url);

    //Obtain client token
    const clientToken = await this.getClientToken();
    if (!clientToken) {
      this.logger.error('Unable to obtain client token from auth-api. Cannot proceed with emailRecipients API call');
      return '';
    }

    const headers = {
      Authorization: `Bearer ${clientToken}`,
    };

    const body = {
      emailType: emailType,
      plantId: plantId,
      submissionType: submissionType,
      userId: userId,
      isMats: isMats,
    };

    const allowLegacyRenegotiationforNodeJsOptions = {
      httpsAgent: new https.Agent({
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      }),
    };

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(url, body, { headers, ...allowLegacyRenegotiationforNodeJsOptions }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.error('Invalid response format from emailRecipients API');
        return '';
      }

      const emailList = response.data
        .map(item => item.emailAddressList)
        .filter(emailAddressList => emailAddressList)
        .join(';');

      return emailList;
    } catch (error) {
      this.logger.error('Error occurred during the API call to emailRecipients', error);
      return '';
    }
  }
}
