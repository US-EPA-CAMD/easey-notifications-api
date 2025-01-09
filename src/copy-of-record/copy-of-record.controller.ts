import { Controller, Res, StreamableFile, Get, Query } from '@nestjs/common';
import { ApiExcludeController, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CopyOfRecordService } from './copy-of-record.service';
import { ReportParamsDTO } from '../dto/report-params.dto';
import type { Response } from 'express';
import { AuditLog, RoleGuard } from '@us-epa-camd/easey-common/decorators';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { ApiExcludeControllerByEnv } from '../decorators/swagger-decorator';

@Controller()
@ApiSecurity('APIKey')
@ApiTags('Copy of Record')
@ApiExcludeControllerByEnv()
export class CopyOfRecordController {
  constructor(private service: CopyOfRecordService) {}

  @Get('copy-of-record')
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'testId',
    required: false,
    explode: false,
  })
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'qceId',
    required: false,
    explode: false,
  })
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'teeId',
    required: false,
    explode: false,
  })
  generatePdf(
    @Query() params: ReportParamsDTO,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.service.getCopyOfRecordPDF(params, res, false);
  }

  @Get('workspace/copy-of-record')
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'testId',
    required: false,
    explode: false,
  })
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'qceId',
    required: false,
    explode: false,
  })
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'teeId',
    required: false,
    explode: false,
  })
  @RoleGuard(
    {
      queryParam: 'facilityId',
      enforceCheckout: false,
      enforceEvalSubmitCheck: false,
    },
    LookupType.Facility,
  )
  @AuditLog({
    label:'Copy of record retrieved from workspace',
    requestQueryOutFields: '*'
  })
  generatePdfWorkspace(
    @Query() params: ReportParamsDTO,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.service.getCopyOfRecordPDF(params, res, true);
  }
}
