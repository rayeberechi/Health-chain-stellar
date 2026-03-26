import { DomainEvent } from '../domain-events/domain-event.interface';
import { MedicalRecordEventType } from '../domain-events/medical-record.events';

import { MedicalRecordAggregate } from './medical-record.aggregate';

const makeEvent = (
  eventType: MedicalRecordEventType,
  payload: Record<string, unknown>,
  aggregateId = 'rec-1',
): DomainEvent => ({
  eventType,
  aggregateId,
  aggregateType: 'MedicalRecord',
  payload,
  occurredAt: new Date(),
});

describe('MedicalRecordAggregate', () => {
  describe('rehydrate', () => {
    it('reconstructs state from RecordUploaded event', () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'hash123',
          recordType: 'lab',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      const state = agg.getState();

      expect(state.patientId).toBe('p-1');
      expect(state.uploadedBy).toBe('u-1');
      expect(state.fileHash).toBe('hash123');
      expect(state.isDeleted).toBe(false);
      expect(agg.getVersion()).toBe(1);
    });

    it('adds to accessList on AccessGranted', () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'h',
          recordType: 'lab',
        }),
        makeEvent(MedicalRecordEventType.ACCESS_GRANTED, {
          grantedTo: 'doctor-1',
          grantedBy: 'u-1',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      expect(agg.getState().accessList).toContain('doctor-1');
    });

    it('removes from accessList on AccessRevoked', () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'h',
          recordType: 'lab',
        }),
        makeEvent(MedicalRecordEventType.ACCESS_GRANTED, {
          grantedTo: 'doctor-1',
          grantedBy: 'u-1',
        }),
        makeEvent(MedicalRecordEventType.ACCESS_REVOKED, {
          revokedFrom: 'doctor-1',
          revokedBy: 'u-1',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      expect(agg.getState().accessList).not.toContain('doctor-1');
    });

    it('records amendments on RecordAmended', () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'h',
          recordType: 'lab',
        }),
        makeEvent(MedicalRecordEventType.RECORD_AMENDED, {
          amendedBy: 'doctor-1',
          changes: { diagnosis: 'updated' },
          reason: 'correction',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      expect(agg.getState().amendments).toHaveLength(1);
      expect(agg.getState().amendments[0].amendedBy).toBe('doctor-1');
    });

    it('marks isDeleted on RecordDeleted', () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'h',
          recordType: 'lab',
        }),
        makeEvent(MedicalRecordEventType.RECORD_DELETED, {
          deletedBy: 'admin',
          reason: 'gdpr',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      expect(agg.getState().isDeleted).toBe(true);
    });

    it('adds to accessList on EmergencyAccessCreated', () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'h',
          recordType: 'lab',
        }),
        makeEvent(MedicalRecordEventType.EMERGENCY_ACCESS_CREATED, {
          accessedBy: 'er-doc',
          justification: 'emergency',
          expiresAt: '2026-01-01T00:00:00Z',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      expect(agg.getState().accessList).toContain('er-doc');
    });

    it('restores state from snapshot and applies subsequent events', () => {
      const snapshotState = {
        id: 'rec-1',
        patientId: 'p-1',
        uploadedBy: 'u-1',
        fileHash: 'h',
        recordType: 'lab',
        isDeleted: false,
        accessList: ['doctor-1'],
        amendments: [],
        version: 50,
      };

      const newEvents = [
        makeEvent(MedicalRecordEventType.ACCESS_REVOKED, {
          revokedFrom: 'doctor-1',
          revokedBy: 'u-1',
        }),
      ];

      const agg = MedicalRecordAggregate.rehydrate(
        'rec-1',
        newEvents,
        snapshotState as Record<string, unknown>,
        50,
      );
      expect(agg.getVersion()).toBe(51);
      expect(agg.getState().accessList).not.toContain('doctor-1');
    });

    it('tracks version correctly across multiple events', () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        makeEvent(MedicalRecordEventType.ACCESS_GRANTED, {
          grantedTo: `doc-${i}`,
          grantedBy: 'u-1',
        }),
      );
      // Prepend upload
      events.unshift(
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED, {
          patientId: 'p-1',
          uploadedBy: 'u-1',
          fileHash: 'h',
          recordType: 'lab',
        }),
      );

      const agg = MedicalRecordAggregate.rehydrate('rec-1', events);
      expect(agg.getVersion()).toBe(6);
    });
  });
});
