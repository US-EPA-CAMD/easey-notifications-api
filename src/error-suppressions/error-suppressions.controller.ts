import { Controller } from '@nestjs/common';
import {
  Body,
  Get,
  Param,
  Put,
  Post,
  Query,
} from '@nestjs/common/decorators';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@us-epa-camd/easey-common/interfaces';
import { AuditLog, RoleGuard, User } from '@us-epa-camd/easey-common/decorators';
import { ErrorSuppressionsService } from './error-suppressions.service';
import { ErrorSuppressionsDTO } from '../dto/error-suppressions.dto';
import { ErrorSuppressionsParamsDTO } from '../dto/error-suppressions.params.dto';
import { ErrorSuppressionsPayloadDTO } from '../dto/error-suppressions-payload.dto';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { ApiExcludeControllerByEnv } from '../decorators/swagger-decorator';
import { BadRequestResponse, NotFoundResponse } from '@us-epa-camd/easey-common/utilities/common-swagger';

@Controller()
@ApiSecurity('APIKey')
@ApiTags('Error Suppressions')
@ApiExcludeControllerByEnv()
export class ErrorSuppressionsController {
  constructor(private service: ErrorSuppressionsService) {}

  @Get()
  @ApiOkResponse({
    isArray: true,
    type: ErrorSuppressionsDTO,
    description: 'Data retrieved successfully',
  })
  @NotFoundResponse()
  @BadRequestResponse()
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'locations',
    required: false,
    explode: false,
  })
  @ApiOperation({
    description: 'Retrieves Error Suppressions per filter criteria.',
  })
  getErrorSuppressions(
    @Query() errorSuppressionsParamsDTO: ErrorSuppressionsParamsDTO,
  ): Promise<ErrorSuppressionsDTO[]> {
    return this.service.getErrorSuppressions(errorSuppressionsParamsDTO);
  }

  @Put(':id')
  @RoleGuard({ requiredRoles: ['ECMPS Admin'] }, LookupType.MonitorPlan)
  @ApiOkResponse({
    description: 'Deactivates the Error Suppression Record',
  })
  @AuditLog({
    label: 'Error Suppression - Deactivate',
    responseBodyOutFields: '*',
  })
  deactivateErrorSuppression(
    @Param('id') id: number,
    @User() user: CurrentUser,
  ): Promise<ErrorSuppressionsDTO> {
    return this.service.deactivateErrorSuppression(id);
  }

  @Post()
  @RoleGuard({ requiredRoles: ['ECMPS Admin'] }, LookupType.MonitorPlan)
  @ApiCreatedResponse({ description: 'Creates an Error Suppression Record' })
  @AuditLog({
    label: 'Error Suppression - Create',
    responseBodyOutFields: '*',
  })
  async createErrorSuppression(
    @Body() payload: ErrorSuppressionsPayloadDTO,
    @User() user: CurrentUser,
  ) {
    return this.service.createErrorSuppression(payload, user.userId);
  }
}
