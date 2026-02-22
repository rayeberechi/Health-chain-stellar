# Inventory Forecasting System

## Overview

The Inventory Forecasting System monitors blood inventory levels, forecasts demand based on historical order data, and triggers automated alerts when stock is projected to fall below safe thresholds.

## Features

- **Automated Forecasting**: Runs on a configurable cron schedule (default: every 6 hours)
- **Demand Calculation**: Uses rolling 30-day order history to calculate average daily demand per blood type per region
- **Projected Supply**: Computes days-of-supply based on current stock and forecasted demand
- **Smart Alerts**: Emits `InventoryLowEvent` when projected supply falls below threshold
- **Multi-Channel Notifications**: Triggers in-app notifications and SMS alerts via Africa's Talking
- **Donor Outreach**: Automatically queues BullMQ jobs to recommend targeted donor outreach
- **Configurable Thresholds**: Supports per-blood-type and per-region threshold configuration

## Architecture

### Components

1. **InventoryForecastingService** - Core forecasting logic with cron scheduling
2. **InventoryEventListener** - Handles `inventory.low` events and triggers notifications
3. **DonorOutreachProcessor** - BullMQ worker for processing donor outreach campaigns
4. **InventoryEntity** - Database entity for tracking blood inventory by type and region
5. **InventoryLowEvent** - Event payload containing alert details

### Data Flow

```
Cron Trigger (every 6h)
  ↓
InventoryForecastingService.runForecast()
  ↓
Calculate demand from 30-day order history
  ↓
Query current inventory levels
  ↓
Compute projected days-of-supply
  ↓
If below threshold → Emit InventoryLowEvent
  ↓
InventoryEventListener handles event
  ↓
├─→ Send in-app notification
├─→ Send SMS alert
└─→ Queue donor outreach job
```

## Configuration

### Environment Variables

```bash
# Cron schedule (default: every 6 hours)
INVENTORY_FORECAST_CRON=0 */6 * * *

# Default threshold in days (default: 3)
INVENTORY_FORECAST_THRESHOLD_DAYS=3

# Historical data window in days (default: 30)
INVENTORY_FORECAST_HISTORY_DAYS=30

# Per-blood-type/region thresholds (optional)
INVENTORY_FORECAST_THRESHOLDS=[{"bloodType":"A+","region":"Nairobi","daysThreshold":5},{"bloodType":"O-","region":"Mombasa","daysThreshold":7}]
```

### Custom Thresholds

You can configure different thresholds for specific blood types and regions:

```json
[
  {
    "bloodType": "A+",
    "region": "Nairobi",
    "daysThreshold": 5
  },
  {
    "bloodType": "O-",
    "region": "Mombasa",
    "daysThreshold": 7
  }
]
```

If no custom threshold is defined, the system uses `INVENTORY_FORECAST_THRESHOLD_DAYS`.

## Database Schema

### Inventory Table

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blood_type VARCHAR NOT NULL,
  region VARCHAR NOT NULL,
  quantity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blood_type, region)
);
```

### Notification Templates

Two templates are automatically seeded:

1. **in-app**: Detailed alert with all metrics
2. **sms**: Concise urgent alert for mobile delivery

## Usage

### Running Forecasts

The service runs automatically on the configured cron schedule. To trigger manually:

```typescript
await inventoryForecastingService.runForecast();
```

### Calculating Forecasts

To get forecast data without triggering alerts:

```typescript
const forecasts = await inventoryForecastingService.calculateDemandForecasts();
// Returns: DemandForecast[]
```

### Forecast Data Structure

```typescript
interface DemandForecast {
  bloodType: string;
  region: string;
  currentStock: number;
  averageDailyDemand: number;
  projectedDaysOfSupply: number;
}
```

## Event Handling

### InventoryLowEvent

Emitted when inventory falls below threshold:

```typescript
{
  bloodType: string;
  region: string;
  currentStock: number;
  projectedDaysOfSupply: number;
  averageDailyDemand: number;
  threshold: number;
}
```

### Listening to Events

```typescript
@OnEvent('inventory.low')
async handleInventoryLow(event: InventoryLowEvent) {
  // Custom handling logic
}
```

## Donor Outreach Queue

When inventory is low, a job is automatically queued:

```typescript
{
  bloodType: string;
  region: string;
  urgency: 'critical' | 'high' | 'medium';
  projectedDaysOfSupply: number;
  requiredUnits: number;
}
```

Urgency levels:
- **critical**: < 1 day of supply
- **high**: 1-3 days of supply
- **medium**: > 3 days but below threshold

## Testing

Run unit tests:

```bash
npm test inventory-forecasting.service.spec.ts
```

### Test Coverage

- ✅ Average daily demand calculation from order history
- ✅ No order history edge case
- ✅ Single data point handling
- ✅ Zero demand scenario (returns Infinity)
- ✅ Zero stock handling
- ✅ Event emission when below threshold
- ✅ No event when above threshold
- ✅ Donor outreach job queuing
- ✅ Custom per-region/blood-type thresholds

## Migration

Run the migration to set up tables and seed templates:

```bash
npm run migration:run
```

This creates:
- `inventory` table with unique constraint on (blood_type, region)
- Notification templates for in-app and SMS alerts

## Monitoring

The service logs:
- Forecast execution start/completion
- Low inventory warnings with details
- Forecast failures with error details
- Number of blood type/region combinations processed

Example log output:

```
[InventoryForecastingService] Running inventory forecast
[InventoryForecastingService] Low inventory alert: A+ in Nairobi - 2.3 days remaining (threshold: 3)
[InventoryForecastingService] Forecast complete. Processed 12 blood type/region combinations
```

## Future Enhancements

- Machine learning-based demand prediction
- Seasonal trend analysis
- Holiday/event-based demand spikes
- Integration with external weather/event APIs
- Automated donor scheduling recommendations
- Real-time inventory updates via webhooks
