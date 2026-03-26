import { DomainEvent } from './domain-event.interface';

export const MedicalRecordEventType = {
  RECORD_UPLOADED: 'RecordUploaded',
  ACCESS_GRANTED: 'AccessGranted',
  ACCESS_REVOKED: 'AccessRevoked',
  RECORD_AMENDED: 'RecordAmended',
  EMERGENCY_ACCESS_CREATED: 'EmergencyAccessCreated',
  RECORD_DELETED: 'RecordDeleted',
} as const;

export type MedicalRecordEventType =
  (typeof MedicalRecordEventType)[keyof typeof MedicalRecordEventType];

export interface RecordUploadedEvent extends DomainEvent {
  eventType: 'RecordUploaded';
  payload: {
    patientId: string;
    uploadedBy: string;
    fileHash: string;
    recordType: string;
  };
}

export interface AccessGrantedEvent extends DomainEvent {
  eventType: 'AccessGranted';
  payload: {
    grantedTo: string;
    grantedBy: string;
    expiresAt?: string;
  };
}

export interface AccessRevokedEvent extends DomainEvent {
  eventType: 'AccessRevoked';
  payload: {
    revokedFrom: string;
    revokedBy: string;
    reason?: string;
  };
}

export interface RecordAmendedEvent extends DomainEvent {
  eventType: 'RecordAmended';
  payload: {
    amendedBy: string;
    changes: Record<string, unknown>;
    reason: string;
  };
}

export interface EmergencyAccessCreatedEvent extends DomainEvent {
  eventType: 'EmergencyAccessCreated';
  payload: {
    accessedBy: string;
    justification: string;
    expiresAt: string;
  };
}

export interface RecordDeletedEvent extends DomainEvent {
  eventType: 'RecordDeleted';
  payload: {
    deletedBy: string;
    reason: string;
  };
}
