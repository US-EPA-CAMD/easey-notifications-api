import {
  ApiTags,
  ApiOkResponse,
  ApiSecurity,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ClientTokenGuard } from '@us-epa-camd/easey-common/guards';
import { AuditLog } from '@us-epa-camd/easey-common/decorators';

import { MailService } from './mail.service';
import { CreateMailDto } from '../dto/create-mail.dto';
import { ClientId } from '../decorators/client-id.decorator';
import { ProcessMailDTO } from '../dto/process-mail.dto';
import { MassEvalParamsDTO } from '../dto/mass-eval-params.dto';
import { MailTemplateService } from './mail-template.service';
import { MailEvalService } from './mail-eval.service';

@Controller()
@ApiTags('Support')
@ApiSecurity('APIKey')
@ApiSecurity('ClientId')
@ApiBearerAuth('ClientToken')
@UseGuards(ClientTokenGuard)
export class MailController {
  constructor(
    private mailService: MailService,
    private mailTemplateService: MailTemplateService,
    private mailEvalService: MailEvalService,
  ) {}

  @Post('contact-us')
  @ApiOkResponse({
    description: 'Data sent successfully',
  })
  @ApiOperation({
    description:
      'Sends an email to a CAMD support inbox determined by the Client Id.',
  })
  @ApiInternalServerErrorResponse()
  @AuditLog({
    label:'Contact us email sent',
    requestHeadersOutFields: ['x-client-id']
  })
  async send(@Body() payload: CreateMailDto, @ClientId() clientId: string) {
    await this.mailService.sendEmail(clientId, payload);
  }

  @Post('email/process')
  @ApiOkResponse({
    description: 'Data sent successfully',
  })
  @ApiOperation({
    description:
      'Processes an email using the associated email record stored in the email_queue',
  })
  @ApiInternalServerErrorResponse()
  @AuditLog({
    label:'Email processed',
    requestHeadersOutFields: ['x-client-id'],
    requestBodyOutFields: ['emailToProcessId']
  })
  async sendRecord(@Body() payload: ProcessMailDTO) {
    await this.mailTemplateService.sendEmailRecord(payload.emailToProcessId);
  }

  @Post('email/mass-eval')
  @ApiOkResponse({
    description: 'Data sent successfully',
  })
  @ApiOperation({
    description:
      'Sends an email to a CAMD support inbox determined by the Client Id.',
  })
  @ApiInternalServerErrorResponse()
  @AuditLog({
    label:'Mass evaluation email sent',
    requestHeadersOutFields: ['x-client-id'],
    requestBodyOutFields: ['evaluationSetId']
  })
  async sendMassEval(@Body() payload: MassEvalParamsDTO) {
    await this.mailEvalService.sendMassEvalEmail(
      payload.toEmail,
      '',
      payload.fromEmail,
      payload.evaluationSetId
    );
  }
}
