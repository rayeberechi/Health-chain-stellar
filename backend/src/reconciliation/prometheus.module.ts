import { Module } from '@nestjs/common';

import { Registry } from 'prom-client';

@Module({
  providers: [
    {
      provide: Registry,
      useFactory: () => new Registry(),
    },
  ],
  exports: [Registry],
})
export class PrometheusModule {}
