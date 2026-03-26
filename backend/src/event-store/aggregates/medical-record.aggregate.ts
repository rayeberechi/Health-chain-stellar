import { DomainEvent } from '../domain-events/domain-event.interface';
import { MedicalRecordEventType } from '../domain-events/medical-record.events';

export interface MedicalRecordState {
  id: string;
  patientId: string;
  uploadedBy: string;
  fileHash: string;
  recordType: string;
  isDeleted: boolean;
  accessList: string[];
  amendments: Array<{
    amendedBy: string;
    changes: Record<string, unknown>;
    reason: string;
  }>;
  version: number;
}

const AGGREGATE_TYPE = 'MedicalRecord';

export class MedicalRecordAggregate {
  private state: MedicalRecordState;
  private version: number;

  private constructor(aggregateId: string) {
    this.state = {
      id: aggregateId,
      patientId: '',
      uploadedBy: '',
      fileHash: '',
      recordType: '',
      isDeleted: false,
      accessList: [],
      amendments: [],
      version: 0,
    };
    this.version = 0;
  }

  static rehydrate(
    aggregateId: string,
    events: DomainEvent[],
    snapshotState?: Record<string, unknown>,
    snapshotVersion = 0,
  ): MedicalRecordAggregate {
    const aggregate = new MedicalRecordAggregate(aggregateId);

    if (snapshotState) {
      aggregate.state = snapshotState as unknown as MedicalRecordState;
      aggregate.version = snapshotVersion;
    }

    for (const event of events) {
      aggregate.apply(event);
    }

    return aggregate;
  }

  getState(): Readonly<MedicalRecordState> {
    return this.state;
  }

  getVersion(): number {
    return this.version;
  }

  getAggregateType(): string {
    return AGGREGATE_TYPE;
  }

  private apply(event: DomainEvent): void {
    this.version++;
    this.state.version = this.version;

    switch (event.eventType as MedicalRecordEventType) {
      case MedicalRecordEventType.RECORD_UPLOADED: {
        const p = event.payload as {
          patientId: string;
          uploadedBy: string;
          fileHash: string;
          recordType: string;
        };
        this.state.patientId = p.patientId;
        this.state.uploadedBy = p.uploadedBy;
        this.state.fileHash = p.fileHash;
        this.state.recordType = p.recordType;
        break;
      }
      case MedicalRecordEventType.ACCESS_GRANTED: {
        const p = event.payload as { grantedTo: string };
        if (!this.state.accessList.includes(p.grantedTo)) {
          this.state.accessList.push(p.grantedTo);
        }
        break;
      }
      case MedicalRecordEventType.ACCESS_REVOKED: {
        const p = event.payload as { revokedFrom: string };
        this.state.accessList = this.state.accessList.filter(
          (id) => id !== p.revokedFrom,
        );
        break;
      }
      case MedicalRecordEventType.RECORD_AMENDED: {
        const p = event.payload as {
          amendedBy: string;
          changes: Record<string, unknown>;
          reason: string;
        };
        this.state.amendments.push({
          amendedBy: p.amendedBy,
          changes: p.changes,
          reason: p.reason,
        });
        break;
      }
      case MedicalRecordEventType.EMERGENCY_ACCESS_CREATED: {
        const p = event.payload as { accessedBy: string };
        if (!this.state.accessList.includes(p.accessedBy)) {
          this.state.accessList.push(p.accessedBy);
        }
        break;
      }
      case MedicalRecordEventType.RECORD_DELETED: {
        this.state.isDeleted = true;
        break;
      }
    }
  }
}
