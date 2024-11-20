import {
  ApiTags,
  ApiQuery,
  ApiSecurity,
  ApiOkResponse,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';

import { Get, Query, Controller, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@us-epa-camd/easey-common/guards';

import { ReportDTO } from '../dto/report.dto';
import { DataSetService } from '../dataset/dataset.service';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { ApiExcludeEndpointByEnv } from '../utilities/swagger-decorator.const';

@Controller()
@ApiTags('Reports')
@ApiSecurity('APIKey')
@UseGuards(AuthGuard)
@ApiBearerAuth('Token')
export class ReportWorkspaceController {
  constructor(private service: DataSetService) {}

  @Get('list')
  @ApiOkResponse({
    type: ReportDTO,
    description: 'Data retrieved successfully',
  })
  @ApiExcludeEndpointByEnv()
  @ApiOperation({
    description: 'Retrieves list of workspace reports available.',
  })
  async getAvailableReports() {
    return this.service.getAvailableDataSets();
  }

  @Get()
  @ApiOkResponse({
    type: ReportDTO,
    description: 'Data retrieved successfully',
  })
  @ApiExcludeEndpointByEnv()
  @ApiOperation({
    description:
      'Retrieves workspace data for various reports based on criteria.',
  })
  @ApiQuery({
    style: 'pipeDelimited',
    name: 'testId',
    required: false,
    explode: false,
  })
  async getReport(@Query() params: ReportParamsDTO) {
    return this.service.getDataSet(params, true);
  }
}
