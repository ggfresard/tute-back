import { Module } from '@nestjs/common';
import { TuteGateway } from './tute.gateway';
import { PlayerService } from './player/player.service';

@Module({
  providers: [TuteGateway, PlayerService],
})
export class TuteModule {}
