import { ApiTags, ApiSecurity, ApiOkResponse, ApiOperation, ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { RoleGuard, AuditLog } from '@us-epa-camd/easey-common/decorators';
import { EvaluationDTO } from '../dto/evaluation.dto';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { EvalErrorParamsDTO } from '../dto/eval-error-params.dto';
import { EvaluationErrorHandlerService } from './evaluation-error-handler.service';
import { LoggingInterceptor } from '@us-epa-camd/easey-common';

@Controller()
@ApiTags('Evaluation')
@ApiSecurity('APIKey')
export class EvaluationController {
  constructor(
    private service: EvaluationService,
    private evaluationErrorHandlerService: EvaluationErrorHandlerService,
  ) {}

  @Post('evaluate')
  @ApiOkResponse({
    description: 'Creates evaluation queue records for quartz',
  })
  @RoleGuard(
    {
      bodyParam: 'items.*.monPlanId',
      requiredRoles: ['Preparer', 'Submitter', 'Sponsor', 'Initial Authorizer'],
    },
    LookupType.MonitorPlan,
  )
  @AuditLog({
    label: 'Creates Evaluation Queue',
    requestBodyOutFields:'*',
    omitFields:['userEmail']
  })
  async evaluate(@Body() params: EvaluationDTO): Promise<void> {
    await this.service.queueEvaluationRecords(params);
  }

  @Post('email/eval-error')
  @ApiOkResponse({
    description: 'Email sent successfully',
  })
  @ApiOperation({
    description: 'Sends an email to the user and to ECMPS CAMD support inbox.',
  })
  @ApiInternalServerErrorResponse()
  @UseInterceptors(LoggingInterceptor)
  async sendEvaluationErrorEmail(@Body() evalErrorParamsDTO: EvalErrorParamsDTO) {
    await this.evaluationErrorHandlerService.sendQueueingErrorEmail(evalErrorParamsDTO);
  }
}
