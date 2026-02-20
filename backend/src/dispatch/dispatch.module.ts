import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
