import { ApiTags, ApiSecurity, ApiOkResponse } from '@nestjs/swagger';
import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { RoleGuard } from '@us-epa-camd/easey-common/decorators';
import { EvaluationDTO } from '../dto/evaluation.dto';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { LoggingInterceptor } from '@us-epa-camd/easey-common/interceptors';

@Controller()
@ApiTags('Evaluation')
@ApiSecurity('APIKey')
export class EvaluationController {
  constructor(private service: EvaluationService) {}

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
  @UseInterceptors(LoggingInterceptor)
  async evaluate(@Body() params: EvaluationDTO): Promise<void> {
    await this.service.queueEvaluationRecords(params);
  }
}
