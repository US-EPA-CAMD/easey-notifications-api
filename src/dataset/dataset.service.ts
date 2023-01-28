import { getManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ReportDTO } from '../dto/report.dto';
import { DataSetRepository } from './dataset.repository';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { DataTable } from '../entities/datatable.entity';
import { ReportDetailDTO } from '../dto/report-detail.dto';
import { ReportColumnDTO } from '../dto/report-column.dto';

@Injectable()
export class DataSetService {
  private hasFacilityInfo: boolean;
  private reportColumns: ReportColumnDTO[];

  constructor(
    @InjectRepository(DataSetRepository)
    private readonly repository: DataSetRepository,
  ) {}

  async getAvailableReports(isWorkspace: boolean = false) {
    const results = await this.repository.find({
      where: { groupCode: 'REPORT' },
    });

    return results.map(e => {
      return {
        code: e.code,
        name: e.displayName,
      };
    });
  }

  async getDataSet(
    params: ReportParamsDTO,
    isWorkspace: boolean = false
  ) {
    this.reportColumns = [];
    this.hasFacilityInfo = false;
    const report = new ReportDTO();
    const schema = isWorkspace ? 'camdecmpswks' : 'camdecmps';
    const dataSet = await this.repository.getDataSet(params.reportCode);
    report.displayName = dataSet.displayName;

    if (params.testId && params.testId.length > 0) {
      const promises = [];
      const tests = await getManager().query(`
        SELECT
          test_sum_id AS "id",
          test_type_cd AS  "code"
        FROM ${schema}.test_summary
        WHERE test_sum_id = ANY($1);`,
        [params.testId]
      );

      tests.forEach((test: { id: string, code: string }) => {
        promises.push(
          new Promise((resolve, _reject) => {
            const detailDef = dataSet.tables.filter(tbl => 
              tbl.template.groupCode === "ALL" ||
              tbl.template.groupCode === test.code
            );
            const details = this.getReportResults(
              schema,
              detailDef,
              params,
              test.id,
            );
            resolve(details);
          })
        );
      });

      await Promise.all(promises);

      report.details = [];
      for (const details of promises) {
        report.details.push(...await details);
      }
    } else {
      report.details = await this.getReportResults(
        schema,
        dataSet.tables,
        params,
      );
    }

    report.columns = this.reportColumns;
    report.details = report.details.filter(
      detail => detail.results.length > 0
    );

    return report;
  }

  async getReportResults(
    schema: string,
    tables: DataTable[],
    params: ReportParamsDTO,
    testId?: string,
  ): Promise<ReportDetailDTO[]> {
    const promises = [];
    const FACINFO = 'FACINFO';

    tables.forEach(tbl => {
      if (!this.hasFacilityInfo || tbl.templateCode !== FACINFO) {
        promises.push(
          new Promise(async (resolve, _reject) => {
            tbl.sqlStatement = tbl.sqlStatement.replace(
              /{SCHEMA}/,
              schema,
            );

            const sqlParams = tbl.parameters.map((param) => {
              if (param.name === 'testId') {
                return testId;
              }
              return params[param.name] ?? param.defaultValue;
            });

            const detailDto = new ReportDetailDTO();
            detailDto.displayName = tbl.displayName
              ? tbl.displayName
              : tbl.template.displayName;
            detailDto.templateCode = tbl.template.code;
            detailDto.templateType = tbl.template.type;
            detailDto.results = await getManager().query(
              tbl.sqlStatement, sqlParams
            );

            if (detailDto.results.length > 0) {
              let columnDto = this.reportColumns.find(column =>
                column.code === tbl.templateCode
              );

              if (!columnDto) {
                columnDto = new ReportColumnDTO();
                columnDto.code = tbl.templateCode;
                columnDto.values = tbl.columns.map(column => {
                  return {
                    name: column.name,
                    displayName: column.displayName,
                  };
                });
                this.reportColumns.push(columnDto);
              }
            }

            resolve(detailDto);
          })
        );
        if (!this.hasFacilityInfo && tbl.templateCode === FACINFO) {
          this.hasFacilityInfo = true;
        }
      }
    });

    return Promise.all(promises);
  }
}