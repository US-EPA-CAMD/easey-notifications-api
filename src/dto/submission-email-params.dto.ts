import { SubmissionSet } from '../entities/submission-set.entity';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { SeverityCode } from '../entities/severity-code.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';

export class SubmissionEmailParamsDto {

  processCode           : string;
  submissionSet         : SubmissionSet;
  submissionQueueRecords: SubmissionQueue [];
  highestSeverityRecord : HighestSeverityRecord;

  //Facility Information
  rptPeriod             : ReportingPeriod; //For EM records only
  monLocationIds        : string;   //Comma separated list
  facilityName          : string;
  facId                 : number;
  orisCode              : number;
  stateCode             : string;
  unitStackPipe         : string;
  monPlanStatus         : string;

  templateContext: any = {};

  toEmail: string;
  ccEmail : string;
  fromEmail: string;
  epaAnalystLink: string;

  constructor(init?: Partial<SubmissionEmailParamsDto>) {
    Object.assign(this, init);
  }
}

export interface HighestSeverityRecord {
  submissionQueue: SubmissionQueue | null;
  severityCode: SeverityCode | null;
}

export function isCritical1Severity(record: HighestSeverityRecord): boolean {
  return record?.submissionQueue?.severityCode?.toUpperCase() === 'CRIT1';
}

export function isResubmissionRequired(record: HighestSeverityRecord): boolean {
  return record?.submissionQueue?.severityCode?.toUpperCase() === 'CRIT1' || record?.submissionQueue?.severityCode?.toUpperCase() === 'CRIT2';
}

export function isNoError(record: HighestSeverityRecord): boolean {
  return record?.submissionQueue?.severityCode?.toUpperCase() === 'NONE';
}

export function hasNonNoneSeverity(record: HighestSeverityRecord): boolean {
  return !isNoError(record);
}

export class SubmissionFeedbackEmailData {
  constructor(
    public toEmail: string,
    public ccEmail: string,
    public fromEmail: string,
    public subject: string,
    public emailTemplate: string,
    public templateContext: any,
    public feedbackAttachmentDocuments: any[],
    public submissionSet : SubmissionSet,
    public submissionQueueRecords : SubmissionQueue [],
    public processCode : string,
  ) {}
}

