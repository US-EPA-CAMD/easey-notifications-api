import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { NumericColumnTransformer } from '@us-epa-camd/easey-common/transforms';
import { MonitorPlan } from './monitor-plan.entity';
import { StackPipe } from './stack-pipe.entity';
import { Unit } from './unit.entity';

@Entity({ name: 'camdecmpswks.monitor_location' })
export class MonitorLocation extends BaseEntity {
  @PrimaryColumn({ name: 'mon_loc_id' })
  monLocIdentifier: string;

  @Column({ name: 'stack_pipe_id' })
  stackPipeIdentifier: string;

  @Column({
    name: 'unit_id',
    type: 'numeric',
    transformer: new NumericColumnTransformer(),
  })
  unitIdentifier: number;

  @Column({ name: 'userid' })
  userid: string;

  @Column({ name: 'add_date' })
  addDate: string;

  @Column({ name: 'update_date' })
  updateDate: string;

  @OneToOne(() => StackPipe, (o) => o.location, { eager: true })
  @JoinColumn({ name: 'stack_pipe_id' })
  stackPipe: StackPipe;

  @OneToOne(() => Unit, (o) => o.location, { eager: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @ManyToMany(() => MonitorPlan, (plan) => plan.locations)
  plans: MonitorPlan[];
}
