import { Controller, Res, StreamableFile, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CopyOfRecordService } from './copy-of-record.service';
import { ReportParamsDTO } from '../dto/report-params.dto';
import type { Response } from 'express';
import { RoleGuard } from '@us-epa-camd/easey-common/decorators';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { ApiExcludeEndpointByEnv } from '../utilities/swagger-decorator.const';

@Controller()
@ApiSecurity('APIKey')
@ApiTags('Copy of Record')
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
  @ApiExcludeEndpointByEnv()
  generatePdfWorkspace(
    @Query() params: ReportParamsDTO,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.service.getCopyOfRecordPDF(params, res, true);
  }
}
