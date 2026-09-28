import { describe, it, expect } from 'vitest';
import {
  Entity,
  ValueObject,
  generateUuidV7,
  isValidUuidV7,
  getTimestampFromUuidV7,
  ok,
  err,
  isOk,
  isErr,
} from '../src/index.js';

class TestIdEntity extends Entity<string> {
  constructor(
    id: string,
    public readonly name: string
  ) {
    super(id);
  }
}

interface AddressProps {
  city: string;
  country: string;
}

class Address extends ValueObject<AddressProps> {
  get city(): string {
    return this.props.city;
  }
}

describe('@platform/domain', () => {
  it('should compare entities by identity', () => {
    const e1 = new TestIdEntity('id-1', 'Name 1');
    const e2 = new TestIdEntity('id-1', 'Name 2');
    const e3 = new TestIdEntity('id-2', 'Name 1');

    expect(e1.equals(e2)).toBe(true);
    expect(e1.equals(e3)).toBe(false);
    expect(e1.equals(null)).toBe(false);
  });

  it('should compare value objects by structural equality', () => {
    const a1 = new Address({ city: 'San Francisco', country: 'US' });
    const a2 = new Address({ city: 'San Francisco', country: 'US' });
    const a3 = new Address({ city: 'New York', country: 'US' });

    expect(a1.equals(a2)).toBe(true);
    expect(a1.equals(a3)).toBe(false);
    expect(a1.equals(undefined)).toBe(false);
  });

  it('should generate monotonic UUIDv7 identifiers', () => {
    const id = generateUuidV7();
    expect(isValidUuidV7(id)).toBe(true);
    const ts = getTimestampFromUuidV7(id);
    expect(ts.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should support functional Result type', () => {
    const successRes = ok(42);
    expect(isOk(successRes)).toBe(true);
    expect(isErr(successRes)).toBe(false);
    if (isOk(successRes)) {
      expect(successRes.data).toBe(42);
    }

    const failureRes = err(new Error('failure'));
    expect(isOk(failureRes)).toBe(false);
    expect(isErr(failureRes)).toBe(true);
    if (isErr(failureRes)) {
      expect(failureRes.error.message).toBe('failure');
    }
  });
});
