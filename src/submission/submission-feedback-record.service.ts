import { Injectable } from '@nestjs/common';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { HighestSeverityRecord, SubmissionEmailParamsDto } from '../dto/submission-email-params.dto';
import { ReportDTO } from '../dto/report.dto';
import { ReportDetailDTO } from '../dto/report-detail.dto';
import { ReportColumnDTO } from '../dto/report-column.dto';

@Injectable()
export class SubmissionFeedbackRecordService {
  constructor(
    private readonly logger: Logger,
  ) {}

  async getSubmissionReceiptData(
    submissionEmailParamsDto: SubmissionEmailParamsDto,
  ): Promise<{ key: string; value: string | { label: string; url: string } }[]> {
    const dataPairs: { key: string; value: string | { label: string; url: string } }[] = [];

    // Add entries in the exact order from the original code
    dataPairs.push({
      key: 'Report Received for Facility ID (ORIS Code):',
      value: submissionEmailParamsDto.orisCode?.toString(),
    });

    dataPairs.push({
      key: 'Facility Name:',
      value: submissionEmailParamsDto.facilityName,
    });

    dataPairs.push({
      key: 'State:',
      value: submissionEmailParamsDto.stateCode,
    });

    dataPairs.push({
      key: 'Monitoring Location(s):',
      value: submissionEmailParamsDto.submissionSet.configuration,
    });

    dataPairs.push({
      key: 'Monitoring Plan Status:',
      value: submissionEmailParamsDto.monPlanStatus,
    });

    // Submission Type using the correct logic
    dataPairs.push({
      key: 'Submission Type:',
      value: await this.getSubmissionType(submissionEmailParamsDto),
    });

    dataPairs.push({
      key: 'Feedback Status Level:',
      value: submissionEmailParamsDto?.highestSeverityRecord?.severityCode?.severityCodeDescription,
    });

    dataPairs.push({
      key: 'Submission Date/Time:',
      value: await this.getDisplayDate(
        submissionEmailParamsDto.submissionSet.queuedTime,
      ),
    });

    dataPairs.push({
      key: 'Submitter User ID:',
      value: submissionEmailParamsDto.submissionSet.userIdentifier,
    });

    dataPairs.push({
      key: 'Submission ID:',
      value: submissionEmailParamsDto.submissionSet.submissionSetIdentifier,
    });

    dataPairs.push({
      key: 'Resubmission Required:',
      value: this.isResubmissionRequired(submissionEmailParamsDto.highestSeverityRecord) ? 'Yes' : 'No',
    });

    // EPA Analyst as a link
    if (submissionEmailParamsDto.epaAnalystLink) {
      dataPairs.push({
        key: 'EPA Analyst:',
        value: { label: 'View Analyst', url: submissionEmailParamsDto.epaAnalystLink },
      });
    }

    return dataPairs;
  }

  // Helper method to determine if resubmission is required
  private isResubmissionRequired(highestSeverityRecord: HighestSeverityRecord): boolean {
    if (!highestSeverityRecord?.severityCode) {
      return false;
    }
    const severityCode = highestSeverityRecord.severityCode.severityCode;
    return severityCode === 'CRIT1' || severityCode === 'CRIT2';
  }

  private async getSubmissionType(submissionEmailParamsDto: SubmissionEmailParamsDto): Promise<string> {
    let submissionTypeText = submissionEmailParamsDto.processCode;
    if (submissionEmailParamsDto.processCode === 'EM' && submissionEmailParamsDto.rptPeriod) {
      submissionTypeText = submissionEmailParamsDto.processCode + ' for ' + submissionEmailParamsDto.rptPeriod.periodAbbreviation;
    }
    return submissionTypeText;
  }

  generateSummaryTableForUnitStack(
    report: ReportDTO,
    locationId: string,
  ): string {
    let summaryTableContent = '';

    // Process each detail from the report. Avoid errors.
    for (const detail of report.details ?? []) {
      const columns = report.columns.find((x) => x.code === detail.templateCode);
      const header = `<b> Unit/Stack/Pipe ID: ${locationId} </b>`;
      summaryTableContent += this.addTable(columns, detail, header);
    }

    return summaryTableContent;
  }

  addTable(
    columns: ReportColumnDTO,
    detail: ReportDetailDTO,
    header: string,
  ): string {
    let innerContent = header;
    innerContent += '<div><table class="default">';

    // Load column headings
    innerContent += '<tr>';
    for (const column of columns?.values ?? []) {
      innerContent += `<th>${column.displayName}</th>`;
    }
    innerContent += '</tr>';

    // Load column rows
    for (const result of detail?.results ?? []) {
      innerContent += '<tr>';
      for (const column of columns?.values ?? []) {
        innerContent += `<td>${result[column.name] ?? ''}</td>`;
      }
      innerContent += '</tr>';
    }

    innerContent += '</table></div>';

    return innerContent;
  }

  generateQATable(report: ReportDTO): string {
    let qaTableContent = '';

    // Process each detail from the report
    for (const detail of report.details ?? []) {
      const columns = report.columns.find((x) => x.code === detail.templateCode);
      const header = `<b>${report.displayName}</b>`;
      qaTableContent += this.addTable(columns, detail, header);
    }

    return qaTableContent;
  }

  public async getDisplayDate(date: Date): Promise<string> {
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  }
}
