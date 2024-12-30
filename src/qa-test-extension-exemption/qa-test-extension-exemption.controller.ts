import { Controller } from '@nestjs/common';
import {
  Get,
  Put,
  Delete,
  Query,
  Param,
  Body,
} from '@nestjs/common/decorators';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { QaTestExtensionExemptionService } from './qa-test-extension-exemption.service';
import { QaCertMaintParamsDto } from '../dto/qa-cert-maint-params.dto';
import { AuditLog, RoleGuard, User } from '@us-epa-camd/easey-common/decorators';
import { CurrentUser } from '@us-epa-camd/easey-common/interfaces';
import { QaUpdateDto } from '../dto/qa-update.dto';
import { SuccessMessageDTO } from '../dto/success-message.dto';
import { QaTeeMaintViewDTO } from '../dto/qa-tee-maint-vw.dto';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { BadRequestResponse, NotFoundResponse } from '@us-epa-camd/easey-common/utilities/common-swagger';
import { ApiExcludeControllerByEnv } from '../decorators/swagger-decorator';
@Controller()
@ApiSecurity('APIKey')
@ApiTags('QA Test Extension Exemption Maintenance')
@ApiExcludeControllerByEnv()
export class QaTestExtensionExemptionController {
  constructor(private service: QaTestExtensionExemptionService) {}

  @Get()
  @NotFoundResponse()
  @BadRequestResponse()
  @ApiOperation({
    description:
      'Retrieves QA Test Extension Exemption maintenance recorcds per filter criteria.',
  })
  @ApiOkResponse({
    isArray: true,
    type: QaTeeMaintViewDTO,
    description: 'Data retrieved successfully',
  })
  getQaTeeViewData(
    @Query() params: QaCertMaintParamsDto,
  ): Promise<QaTeeMaintViewDTO[]> {
    return this.service.getQaTeeViewData(params.orisCode, params.unitStack);
  }

  @Put(':id')
  @RoleGuard({ requiredRoles: ['ECMPS Admin'] }, LookupType.MonitorPlan)
  @ApiOkResponse({
    isArray: false,
    type: QaTeeMaintViewDTO,
    description: 'Changes submission status to resubmit',
  })
  @ApiOperation({
    description:
      'Changes submission status to resubmit and update re-submission explanation for QA Test maintenance record.',
  })
  @AuditLog({
    label: 'QA Test Extension Exemption Maintenance - Require Resubmission',
    responseBodyOutFields: '*',
  })
  updateSubmissionStatus(
    @Param('id') id: string,
    @User() user: CurrentUser,
    @Body() payload: QaUpdateDto,
  ): Promise<QaTeeMaintViewDTO> {
    return this.service.updateSubmissionStatus(id, user.userId, payload);
  }

  @Delete(':id')
  @RoleGuard({ requiredRoles: ['ECMPS Admin'] }, LookupType.MonitorPlan)
  @ApiOkResponse({
    isArray: false,
    type: SuccessMessageDTO,
    description:
      'Deletes a QA Test Extension Exemption maintenance record successfully.',
  })
  @ApiOperation({
    description:
      'Deletes a QA Test Extension Exemption maintenance record from global.',
  })
  @AuditLog({
    label: 'QA Test Extension Exemption Maintenance - Delete',
    responseBodyOutFields: '*',
  })
  async deleteQACertTeeData(@Param('id') id: string): Promise<any> {
    return this.service.deleteQACertTeeData(id);
  }
}
