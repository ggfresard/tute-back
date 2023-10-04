import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TuteModule } from './tute/tute.module';

@Module({
  imports: [TuteModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
