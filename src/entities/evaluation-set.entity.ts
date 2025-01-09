import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

import { NumericColumnTransformer } from '@us-epa-camd/easey-common/transforms';

@Entity({ name: 'camdecmpsaux.evaluation_set' })
export class EvaluationSet extends BaseEntity {
  @PrimaryColumn({ name: 'evaluation_set_id' })
  evaluationSetIdentifier: string;

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
}
