import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderStateMachine } from './state-machine/order-state-machine';
import { OrderEventStoreService } from './services/order-event-store.service';
import { OrdersGateway } from './gateways/orders.gateway';
import { OrderEntity } from './entities/order.entity';
import { OrderEventEntity } from './entities/order-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderEventEntity]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderStateMachine,
    OrderEventStoreService,
    OrdersGateway,
  ],
  exports: [OrdersService, OrderStateMachine, OrderEventStoreService],
})
export class OrdersModule {}
