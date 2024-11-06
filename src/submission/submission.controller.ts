import {
  ApiTags,
  ApiSecurity,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Body, Controller, Post, UseGuards, Get, Query,UseInterceptors } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { RoleGuard } from '@us-epa-camd/easey-common/decorators';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { SubmissionQueueDTO } from '../dto/submission-queue.dto';
import { ClientTokenGuard } from '@us-epa-camd/easey-common/guards';
import { SubmissionProcessService } from './submission-process.service';
import { ProcessParamsDTO } from '../dto/process-params.dto';
import { SubmissionsLastUpdatedResponseDTO } from '../dto/submission-last-updated.dto';
import { LoggingInterceptor } from '@us-epa-camd/easey-common/interceptors';

@Controller()
@ApiTags('Submission')
@ApiSecurity('APIKey')
export class SubmissionController {
  constructor(
    private service: SubmissionService,
    private processService: SubmissionProcessService,
  ) {}

  @Get('last-updated')
  @ApiOkResponse({
    type: SubmissionsLastUpdatedResponseDTO,
    description:
      'Returns all submission records that have been updated / submitted since the input date.',
  })
  async lastUpdated(
    @Query('date') queryTime: string,
  ): Promise<SubmissionsLastUpdatedResponseDTO> {
    return this.service.getLastUpdated(queryTime);
  }

  @Post('queue')
  @ApiOkResponse({
    description:
      'Creates submission queue records for quartz copy of record process',
  })
  @RoleGuard(
    { bodyParam: 'items.*.monPlanId', requiredRoles: ['Submitter', 'Sponsor', 'Initial Authorizer'] },
    LookupType.MonitorPlan,
  )
  @UseInterceptors(LoggingInterceptor)
  async queue(@Body() params: SubmissionQueueDTO): Promise<void> {
    await this.service.queueSubmissionRecords(params);
  }

  @Post('process')
  @ApiOkResponse({
    description:
      'Creates copy of record and calls into submission sign service',
  })
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  async process(@Body() params: ProcessParamsDTO): Promise<void> {
    this.processService.processSubmissionSet(params.submissionSetId);
  }
}
