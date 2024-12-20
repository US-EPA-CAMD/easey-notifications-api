import { Request } from 'express';

import {
  ApiTags,
  ApiOkResponse,
  ApiSecurity,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { Controller, Get, Req, Post, Body, UseGuards } from '@nestjs/common';
import { ClientTokenGuard } from '@us-epa-camd/easey-common/guards';
import { AuditLog } from '@us-epa-camd/easey-common/decorators';

import { BulkFileDTO } from '../dto/bulk_file.dto';
import { BulkFileService } from './bulk-file.service';
import { BulkFileInputDTO } from '../dto/bulk_file_input.dto';
import {
  ApportionedEmissionsQuarterlyDTO,
  ApportionedEmissionsStateDTO,
  ProgramCodeDTO,
  TimePeriodDTO,
} from '../dto/bulk-file-mass-generation.dto';
import { MassBulkFileService } from './mass-bulk-file.service';
import { ApiExcludeEndpointByEnv } from '../decorators/swagger-decorator';

@Controller()
@ApiSecurity('APIKey')
@ApiTags('Bulk Files')
export class BulkFileController {
  constructor(
    private service: BulkFileService,
    private massService: MassBulkFileService,
  ) {}

  @Get()
  @ApiOkResponse({
    isArray: true,
    type: BulkFileDTO,
    description: 'Data retrieved successfully',
  })
  @ApiOperation({
    description:
      'Retrieves a list of bulk data files and their metadata from S3.',
  })
  async getBulkFiles(@Req() req: Request): Promise<BulkFileDTO[]> {
    const curDate = new Date();
    curDate.setDate(curDate.getDate() + 1);
    curDate.setHours(8, 0, 0, 0);
    req.res.removeHeader('Pragma');
    req.res.setHeader('Cache-Control', 'Public');
    req.res.setHeader('Expires', new Date(curDate).toUTCString());
    return this.service.getBulkDataFiles();
  }

  @Post('apportioned-emissions/state')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated apportioned emission bulk files by state',
    requestBodyOutFields: '*'
  })
  async massBulkFileState(
    @Body() params: ApportionedEmissionsStateDTO,
  ): Promise<void> {
    await this.massService.generateStateApportionedEmissions(params);
  }

  @Post('apportioned-emissions/quarter')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated apportioned emission bulk files by quarter',
    requestBodyOutFields: '*'
  })
  async massBulkFileQuarter(
    @Body() params: ApportionedEmissionsQuarterlyDTO,
  ): Promise<void> {
    await this.massService.generateQuarterApportionedEmissions(params);
  }

  @Post('facility')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated bulk files facility',
    requestHeadersOutFields: ['x-client-id'],
    requestBodyOutFields: '*',
  })
  async massBulkFileFacility(@Body() params: TimePeriodDTO): Promise<void> {
    await this.massService.generateFacility(params);
  }

  @Post('emissions-compliance')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated emissions compliance bulk files',
    requestHeadersOutFields: ['x-client-id'],
    responseBodyOutFields: '*',
  })
  async massBulkFileEmissionsCompliance(): Promise<void> {
    await this.massService.generateEmissionsCompliance();
  }

  @Post('allowance-holdings')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated allowance holdings bulk files',
    requestHeadersOutFields: ['x-client-id'],
    requestBodyOutFields: '*',
  })
  async massBulkFileAllowanceHoldings(
    @Body() params: ProgramCodeDTO,
  ): Promise<void> {
    await this.massService.generateAllowanceHoldings(params);
  }

  @Post('allowance-compliance')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated allowance compliance bulk files',
    requestHeadersOutFields: ['x-client-id'],
    requestBodyOutFields: '*',
  })
  async massBulkFileAllowanceCompliance(
    @Body() params: ProgramCodeDTO,
  ): Promise<void> {
    await this.massService.generateAllowanceCompliance(params);
  }

  @Post('allowance-transactions')
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated allowance transactions bulk files',
    requestHeadersOutFields: ['x-client-id'],
    requestBodyOutFields: '*',
  })
  async massBulkFileAllowanceTransactions(
    @Body() params: ProgramCodeDTO,
  ): Promise<void> {
    await this.massService.generateAllowanceTransactions(params);
  }

  @Post('metadata')
  @ApiOkResponse({
    type: BulkFileDTO,
    description: 'Creates metadata for bulk files store in S3',
  })
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiExcludeEndpointByEnv()
  @AuditLog({
    label:'Generated bulk file metadata',
    requestHeadersOutFields: ['x-client-id'],
    responseBodyOutFields: '*',
  })
  async addBulkFile(
    @Body() bulkDataFile: BulkFileInputDTO,
  ): Promise<BulkFileDTO> {
    return this.service.addBulkDataFile(bulkDataFile);
  }
}
