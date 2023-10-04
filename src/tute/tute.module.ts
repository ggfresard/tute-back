import { Module } from '@nestjs/common';
import { TuteGateway } from './tute.gateway';

@Module({
  providers: [TuteGateway]
})
export class TuteModule {}
