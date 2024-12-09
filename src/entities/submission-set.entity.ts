import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

import { NumericColumnTransformer } from '@us-epa-camd/easey-common/transforms';

@Entity({ name: 'camdecmpsaux.submission_set' })
export class SubmissionSet extends BaseEntity {
  @PrimaryColumn({ name: 'submission_set_id' })
  submissionSetIdentifier: string;

  @Column({ name: 'mon_plan_id' })
  monPlanIdentifier: string;

  @Column({ name: 'queued_time' })
  queuedTime: Date;

  @Column({ name: 'user_id' })
  userIdentifier: string;

  @Column({ name: 'user_email' })
  userEmail: string;

  @Column({
    name: 'fac_id',
    type: 'numeric',
    transformer: new NumericColumnTransformer(),
  })
  facIdentifier: number;

  @Column({
    name: 'oris_code',
    type: 'numeric',
    transformer: new NumericColumnTransformer(),
  })
  orisCode: number;

  @Column({ name: 'fac_name' })
  facName: string;

  @Column({ name: 'configuration' })
  configuration: string;

  @Column({ name: 'activity_id' })
  activityId: string;

  @Column({ name: 'status_cd' })
  statusCode: string;

  @Column({ name: 'started_time' })
  startedTime?: Date;

  @Column({ name: 'completed_time' })
  completedTime?: Date;

  @Column({ name: 'note' })
  note?: string;

  @Column({ name: 'note_time' })
  noteTime?: Date;

  @Column({ name: 'has_crit_errors' })
  hasCritErrors: boolean;
}
