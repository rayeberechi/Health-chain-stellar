export class ConcurrencyException extends Error {
  constructor(
    aggregateId: string,
    expectedVersion: number,
    actualVersion: number,
  ) {
    super(
      `Concurrency conflict on aggregate '${aggregateId}': ` +
        `expected version ${expectedVersion}, found ${actualVersion}. Retry the operation.`,
    );
    this.name = 'ConcurrencyException';
  }
}
