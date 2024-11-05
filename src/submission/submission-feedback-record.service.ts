import { ReportDetailDTO } from './../dto/report-detail.dto';
import { Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EntityManager } from 'typeorm';
import { ReportDTO } from '../dto/report.dto';
import { ReportColumnDTO } from '../dto/report-column.dto';
import { DataSetService } from '../dataset/dataset.service';
import { KeyValuePairs } from '../dto/submission-email-params.dto';

@Injectable()
export class SubmissionFeedbackRecordService {
  constructor(
    private readonly logger: Logger,
    private dataService: DataSetService,
    private readonly entityManager: EntityManager,
  ) {}

  generateSummaryTableForUnitStack(data: ReportDTO, unitStackPipe: string): string {
    let summaryTableContent = '';

    // Process each detail from the report
    for (const detail of data.details) {
      const columns = data.columns.find((x) => x.code === detail.templateCode);
      let header = `<b> Unit/Stack/Pipe ID: ${unitStackPipe} </b>`;
      summaryTableContent += this.addTable(columns, detail, header);
    }

    return summaryTableContent;
  }

  addTable(columns: ReportColumnDTO, detail: ReportDetailDTO, header: string): string {
    let innerContent = header;
    innerContent += '<div> <table class = "default">';

    //Load column headings
    innerContent += '<tr>';
    for (const column of columns?.values ?? []) {
      innerContent += `<th> ${column.displayName} </th>`;
    }
    innerContent += '</tr>';

    //Load column rows
    for (const result of detail?.results ?? []) {
      innerContent += '<tr>';
      for (const column of columns.values) {
        if (result[column.name]) {
          innerContent += `<td> ${result[column.name]} </td>`;
        } else {
          innerContent += `<td></td>`;
        }
      }
      innerContent += '</tr>';
    }

    innerContent += '</table> </div>';

    return innerContent;
  }

  getSubmissionReceiptTableContent(pairs: KeyValuePairs): string {
    let innerContent = '<div> <table class = "col-table">';

    for (const [key, value] of Object.entries(pairs)) {
      innerContent += '<tr>';
      innerContent += `<td>${key}</td>`;
      if (typeof value === 'string') {
        innerContent += `<td>${value}</td>`;
      } else if (typeof value === 'object' && 'label' in value && 'url' in value) {
        innerContent += `<td><a href="${value.url}">${value.label}</a></td>`;
      }
      innerContent += '</tr>';
    }

    innerContent += '</table> </div>';

    return innerContent;
  }

  generateQATable(data: ReportDTO): string {
    let qaTableContent = '';

    // There should only be one detail here.
    for (const detail of data.details) {
      const columns = data.columns.find((x) => x.code === detail.templateCode);
      let header = `<b> ${data.displayName} </b>`;
      qaTableContent += this.addTable(columns, detail, header);
    }

    return qaTableContent;
  }

}
