import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BloodRequestEntity } from '../blood-requests/entities/blood-request.entity';
import { BloodUnit } from '../blood-units/entities/blood-unit.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { UsersModule } from '../users/users.module';

import { InventoryAlertController } from './controllers/inventory-alert.controller';
import { ExpirationForecastingController } from './controllers/expiration-forecasting.controller';
import { AlertPreferenceEntity } from './entities/alert-preference.entity';
import { InventoryAlertEntity } from './entities/inventory-alert.entity';
import { InventoryStockEntity } from './entities/inventory-stock.entity';
import { InventoryEntity } from './entities/inventory.entity';
import { ExpirationForecastingService } from './expiration-forecasting.service';
import { InventoryEventListener } from './inventory-event.listener';
import { InventoryForecastingService } from './inventory-forecasting.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { DonorOutreachProcessor } from './processors/donor-outreach.processor';
import { InventoryAlertService } from './services/inventory-alert.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      InventoryEntity,
      InventoryStockEntity,
      InventoryAlertEntity,
      AlertPreferenceEntity,
      BloodUnit,
      OrganizationEntity,
      BloodRequestEntity,
    ]),
    BullModule.registerQueue({
      name: 'donor-outreach',
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [InventoryController, InventoryAlertController, ExpirationForecastingController],
  providers: [
    InventoryService,
    InventoryForecastingService,
    InventoryEventListener,
    DonorOutreachProcessor,
    InventoryAlertService,
    ExpirationForecastingService,
  ],
  exports: [
    InventoryService,
    InventoryForecastingService,
    InventoryAlertService,
    ExpirationForecastingService,
  ],
})
export class InventoryModule {}
