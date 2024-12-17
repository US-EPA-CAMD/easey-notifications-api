import { ReportDetailDTO } from './../dto/report-detail.dto';
import { Injectable, StreamableFile } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { EntityManager } from 'typeorm';
import { copyOfRecordTemplate } from './template';
import { certTemplate } from './cert-template';
import { ReportDTO } from '../dto/report.dto';
import { ReportColumnDTO } from '../dto/report-column.dto';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { DataSetService } from '../dataset/dataset.service';
import { createReadStream, writeFileSync, rmSync, stat } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { Plant } from '../entities/plant.entity';

@Injectable()
export class CopyOfRecordService {
  constructor(
    private readonly logger: Logger,
    private dataService: DataSetService,
    private readonly entityManager: EntityManager,
  ) { }

  addDocumentHeader(content: string, title: string): string {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    };

    content = content.replace(
      '{DATE}',
      date.toLocaleDateString('en-US', options),
    );

    return content.replace('{HEADER}', title);
  }

  addTableHeader(
    title: string,
    isTest: boolean = false,
    detail?: ReportDetailDTO,
  ): string {
    let heading = `<h3 class =${isTest ? 'test-header' : ''} > ${title} </h3>`;

    if (detail && detail.templateType === 'DEFAULT2') {
      const opLevelRefMethod = detail.results[0];
      const code = opLevelRefMethod['referenceMethodCode'];
      const description = opLevelRefMethod['referenceMethodDescription'];
      heading = `<hr/><div>${title}</div><div>Reference Method Used: ${code} - ${description}</div><hr/>`;
    }

    return heading;
  }
  addEvaluationPassTable() {
    let innerContent = this.addTableHeader('Evaluation Results', false);
    innerContent += '<div class = "col-table-container">Evaluation has passed without errors</div>';
    return innerContent;
  }

  addColTable(
    columns: ReportColumnDTO,
    results: any,
    displayName: string,
    columnCount: number,
    isTest: boolean = false,
  ): string {
    let innerContent = this.addTableHeader(displayName, isTest);
    innerContent += '<div class = "col-table-container">';

    //Set up our column groupings
    const groups = [];
    for (let i = 0; i < columnCount; i++) {
      groups.push([]);
    }

    for (let i = 0; i < (columns?.values?.length ?? 0); i++) {
        groups[i % columnCount].push([
        columns.values[i].displayName,
        columns.values[i].name,
      ]);
    }

    for (const group of groups) {
      innerContent += '<table class="col-table">';

      for (const item of group) {
        innerContent += '<tr>';
        if (item[0] === 'HIDDEN') {
          innerContent += `<th>&nbsp;</th>`;
          innerContent += `<td>&nbsp;</td>`;
        } else if (results[0][item[1]] === null) {
          innerContent += `<th>${item[0]}</th>`;
          innerContent += `<td>&nbsp;</td>`;
        } else {
          innerContent += `<th>${item[0]}</th>`;
          innerContent += `<td>${results[0][item[1]]}</td>`;
        }
        innerContent += '</tr>';
      }

      innerContent += '</table>';
    }

    innerContent += '</div>';

    return innerContent;
  }

  addDefaultTable(columns: ReportColumnDTO, detail: ReportDetailDTO): string {
    let innerContent = this.addTableHeader(detail.displayName, false, detail);

    innerContent += '<div> <table class = "default">';

    //Load column headings
    innerContent += '<tr>';
    for (const column of columns.values) {
      innerContent += `<th> ${column.displayName} </th>`;
    }
    innerContent += '</tr>';

    const codeToDefinitions = new Map<string, string[]>(); //Prepopulate our table of code descriptions used for the table legend

    //Load column rows
    for (const result of detail.results) {
      innerContent += '<tr>';
      for (const column of columns.values) {
        //Populate the code definitions for the legend of this table
        if (
          result[column.name + 'Group'] &&
          result[column.name + 'Description']
        ) {
          if (codeToDefinitions.has(result[column.name + 'Group'])) {
            const arr = codeToDefinitions.get(result[column.name + 'Group']);
            arr.push(
              `${result[column.name]} - ${result[column.name + 'Description']}`,
            );

            codeToDefinitions.set(result[column.name + 'Group'], arr);
          } else {
            const arr = [];
            arr.push(
              `${result[column.name]} - ${result[column.name + 'Description']}`,
            );

            codeToDefinitions.set(result[column.name + 'Group'], arr);
          }
        }

        if (result[column.name]) {
          innerContent += `<td> ${result[column.name]} </td>`;
        } else {
          innerContent += `<td></td>`;
        }
      }
      innerContent += '</tr>';
    }

    innerContent += '</table> </div>';

    //Populate legend from map
    codeToDefinitions.forEach((vals, key) => {
      if (vals.length > 0) {
        const minifiedVals = new Set(vals);
        innerContent +=
          '<div class ="code-section"> <div class = "col-table-container">';

        innerContent += `<div class = "code-group"> ${key}: </div>`;
        innerContent += `<div class = "code-values">`;

        for (const codeVal of Array.from(minifiedVals)) {
          innerContent += `<div> ${codeVal} </div>`;
        }

        innerContent += '</div> </div> </div>';
      }
    });

    return innerContent;
  }

  generateCopyOfRecordCert(statements: object[]): string {
    let documentContent = certTemplate;
    documentContent = this.addDocumentHeader(
      documentContent,
      'Certification Statement(s)',
    );
    let innerContent = '';

    statements.forEach((val, idx) => {
      innerContent += `<p> ${val['statementText']} </p>`;
      if (idx + 1 < statements.length) {
        innerContent += '<hr/>';
      }
    });

    documentContent = documentContent.replace('{CONTENT}', innerContent);

    return documentContent;
  }

  generateCopyOfRecord(data: ReportDTO, isPdf: boolean = false, evalStatusCodes: Set<string> = new Set()): string {
    let documentContent = copyOfRecordTemplate;
    documentContent = this.addDocumentHeader(documentContent, data.displayName);
    let innerContent = '';

    // Process each detail from the report
    for (const detail of data.details) {
      const columns = data.columns.find((x) => x.code === detail.templateCode);
      const templateType = detail.templateType;
      const results = detail.results;

      if (templateType.includes('COLTBL')) {
        let modifiedDisplayName = detail.displayName;
        let isTest = false;

        if (results[0]['unitStack']) {
          isTest = true;
          modifiedDisplayName = `Unit/Stack/Pipe ID: ${results[0]['unitStack']}<br/>${modifiedDisplayName}`;
        }

        //Special formatting for smaller column sizes
        innerContent += this.addColTable(
          columns,
          results,
          modifiedDisplayName,
          parseInt(templateType.charAt(0)),
          isTest,
        );
        //only 1 detail object in deta.details means the report does not have any errors
        if (data.details.length === 1) {
          innerContent += this.addEvaluationPassTable();
        }
      } else {
        //Default table view
        innerContent += this.addDefaultTable(columns, detail);
      }
    }

    documentContent = documentContent.replace('{CONTENT}', innerContent);

    return documentContent;
  }

  async getCopyOfRecordPDF(
    params: ReportParamsDTO,
    res: Response,
    isWorkspace: boolean,
  ): Promise<StreamableFile> {
    const reportInformation = await this.dataService.getDataSet(
      params,
      isWorkspace,
    );

    const htmlContent = this.generateCopyOfRecord(reportInformation, true);

    const plant: Plant = await this.entityManager.findOneBy(Plant, {
      orisCode: params.facilityId,
    });

    let responseFileName;
    if (params.reportCode === 'EM') {
      responseFileName = `${params.reportCode}_${plant.orisCode}_${params.year}Q${params.quarter}.html`;
    } else {
      responseFileName = `${params.reportCode}_${plant.facilityName}_${plant.orisCode}.html`;
    }

    res.set({
      'Content-Type': 'application/html',
      'Content-Disposition': `attachment; filename="${responseFileName}"`,
    });

    const fileName = uuidv4();

    writeFileSync(`${__dirname}/${fileName}.html`, htmlContent);

    const stream = createReadStream(`${__dirname}/${fileName}.html`);
    stream.on('end', () => {
      rmSync(`${__dirname}/${fileName}.html`);
    });

    return new StreamableFile(stream);
  }
}
