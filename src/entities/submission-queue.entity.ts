import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

import { NumericColumnTransformer } from '@us-epa-camd/easey-common/transforms';

@Entity({ name: 'camdecmpsaux.submission_queue' })
export class SubmissionQueue extends BaseEntity {
  @PrimaryColumn({ name: 'submission_id' })
  submissionIdentifier: number;

  @Column({ name: 'submission_set_id' })
  submissionSetIdentifier: string;

  @Column({ name: 'process_cd' })
  processCode: string;

  @Column({ name: 'test_sum_id' })
  testSumIdentifier: string;

  @Column({ name: 'qa_cert_event_id' })
  qaCertEventIdentifier: string;

  @Column({ name: 'test_extension_exemption_id' })
  testExtensionExemptionIdentifier: string;

  @Column({
    name: 'rpt_period_id',
    type: 'numeric',
    transformer: new NumericColumnTransformer(),
  })
  rptPeriodIdentifier: number;

  @Column({
    name: 'mats_bulk_file_id',
    type: 'numeric',
    transformer: new NumericColumnTransformer(),
  })
  matsBulkFileId: number;

  @Column({ name: 'severity_cd' })
  severityCode: string;

  @Column({ name: 'submitted_on' })
  submittedOn: Date;

  @Column({ name: 'status_cd' })
  statusCode: string;

  @Column({ name: 'details' })
  details: string;
}
