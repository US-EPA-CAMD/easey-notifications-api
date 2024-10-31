import { Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import * as crypto from 'crypto';


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
    userId: string,
    submissionType: string,
    isMats: string = '',
    emailType: string = 'SUBMISSIONCONFIRMATION',
    plantId: string = '0',
  ): Promise<string> {

    this.logger.debug('getEmailRecipients with params', { emailType, plantId, userId, submissionType, isMats });

    const recipientsListApiUrl = this.configService.get<string>('app.recipientsListApi');
    if (!recipientsListApiUrl) {
      this.logger.error('recipientsListApiUrl is not configured');
      return '';
    }

    this.logger.debug('using recipientsListApiUrl: ' + recipientsListApiUrl);

    //Obtain client token
    const clientToken = await this.getClientToken();
    if (!clientToken) {
      this.logger.error('Unable to obtain client token from auth-api. Cannot proceed with emailRecipients API call');
      return '';
    }

    const headers = {
      'x-api-key': this.configService.get<string>('app.apiKey'),
      'x-client-id': this.configService.get<string>('app.clientId'),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    };

    const body = {
      emailType: emailType,
      plantId: plantId,
      submissionType: submissionType,
      userId: userId,
      isMats: isMats,
    };

    this.logger.debug('Making API call to:', { url: recipientsListApiUrl });

    const allowLegacyRenegotiationforNodeJsOptions = {
      httpsAgent: new https.Agent({
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      }),
    };

    // This request is a bit unconventional.  The CBS API expects a GET request with a body.
    // Axios does not support this, so we are using the httpService.request method
    try {

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.request({
          method: 'GET',
          url: recipientsListApiUrl,
          headers: headers,
          data: body,
          ...allowLegacyRenegotiationforNodeJsOptions,
        }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.error('Invalid response format from emailRecipients API', response.data);
        return '';
      }

      if (Array.isArray(response.data) && response.data.length > 0) {
        this.logger.debug('First item of the email list: ', response.data[0]);
      } else {
        this.logger.debug('response.data is is empty.');
      }

      const emailList = response.data
        .map(item => item.emailAddressList)
        .filter(emailAddressList => emailAddressList)
        .join(';');

      return emailList;
    } catch (error) {
      this.logger.error('Error occurred during the API call to emailRecipients', error.message || error);
      // Check if the error has a response (e.g., HTTP status code errors)
      if (error.response) {
        this.logger.error('API response error status:', error.response.status || '');
        this.logger.error('API response error data:', error.response.data || '');
      }
    }
  }
}
