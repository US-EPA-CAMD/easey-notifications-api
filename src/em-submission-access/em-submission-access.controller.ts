import { Controller } from '@nestjs/common';
import { Get, Query, Post, Put, Body, Param } from '@nestjs/common/decorators';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiExcludeControllerByEnv,
  BadRequestResponse,
  NotFoundResponse,
} from '../utilities/swagger-decorator.const';
import { EmSubmissionAccessService } from './em-submission-access.service';
import {
  EmSubmissionAccessCreateDTO,
  EmSubmissionAccessDTO,
  EmSubmissionAccessUpdateDTO,
} from '../dto/em-submission-access.dto';
import { EmSubmissionAccessParamsDTO } from '../dto/em-submission-access.params.dto';
import {
  AuditLog,
  RoleGuard,
  User,
} from '@us-epa-camd/easey-common/decorators';
import { CurrentUser } from '@us-epa-camd/easey-common/interfaces';
import { LookupType } from '@us-epa-camd/easey-common/enums';

@Controller()
@ApiSecurity('APIKey')
@ApiTags('Em Submission Access')
@ApiExcludeControllerByEnv()
export class EmSubmissionAccessController {
  constructor(private service: EmSubmissionAccessService) {}

  @Get()
  @ApiOkResponse({
    isArray: true,
    type: EmSubmissionAccessDTO,
    description: 'Data retrieved successfully',
  })
  @NotFoundResponse()
  @BadRequestResponse()
  @ApiOperation({
    description:
      'Retrieves Emission Submission Access Data per filter criteria.',
  })
  getEmSubmissionAccess(
    @Query() emSubmissionAccessParamsDTO: EmSubmissionAccessParamsDTO,
  ): Promise<EmSubmissionAccessDTO[]> {
    return this.service.getEmSubmissionAccess(emSubmissionAccessParamsDTO);
  }

  @Post()
  @RoleGuard({ requiredRoles: ['ECMPS Admin'] }, LookupType.MonitorPlan)
  @ApiCreatedResponse({
    isArray: false,
    type: EmSubmissionAccessDTO,
    description: 'Data created successfully',
  })
  @ApiOperation({
    description: 'Creates an Emission Submission Access Record.',
  })
  @AuditLog({
    label: 'Emission Submission Access - Create',
    responseBodyOutFields: '*',
  })
  async createEmSubmissionAccess(
    @Body() payload: EmSubmissionAccessCreateDTO,
    @User() user: CurrentUser,
  ) {
    return this.service.createEmSubmissionAccess(payload, user.userId);
  }

  @Put(':id')
  @RoleGuard({ requiredRoles: ['ECMPS Admin'] }, LookupType.MonitorPlan)
  @ApiOkResponse({
    isArray: false,
    type: EmSubmissionAccessDTO,
    description: 'Data updated successfully.',
  })
  @ApiOperation({
    description: 'Updates an Emission Submission Access Record.',
  })
  @AuditLog({
    label: 'Emission Submission Access - Update',
    responseBodyOutFields: '*',
  })
  async updateEmSubmissionAccess(
    @Param('id') id: number,
    @Body() payload: EmSubmissionAccessUpdateDTO,
  ) {
    return this.service.updateEmSubmissionAccess(id, payload);
  }
}
