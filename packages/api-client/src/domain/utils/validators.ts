import { ConnpassValidationError } from '../../domain/errors';
import { EventSearchParams, GroupSearchParams, UserSearchParams } from '../../domain/entities';

export class Validators {
  static validateEventSearchParams(params: EventSearchParams): void {
    if (params.count !== undefined && (params.count < 1 || params.count > 100)) {
      throw new ConnpassValidationError('Count must be between 1 and 100');
    }

    if (params.start !== undefined && params.start < 1) {
      throw new ConnpassValidationError('Start must be greater than 0');
    }

    if (params.order !== undefined && ![1, 2, 3].includes(params.order)) {
      throw new ConnpassValidationError('Order must be 1 (updated_at desc), 2 (started_at asc), or 3 (started_at desc)');
    }

    if (params.eventId && params.eventId.some(id => id <= 0)) {
      throw new ConnpassValidationError('All event IDs must be positive numbers');
    }

    if (params.groupId && params.groupId.some(id => id <= 0)) {
      throw new ConnpassValidationError('All group IDs must be positive numbers');
    }

    if (params.ymdFrom && !/^\d{4}-\d{2}-\d{2}$/.test(params.ymdFrom)) {
      throw new ConnpassValidationError('ymdFrom must be in YYYY-MM-DD format');
    }

    if (params.ymdTo && !/^\d{4}-\d{2}-\d{2}$/.test(params.ymdTo)) {
      throw new ConnpassValidationError('ymdTo must be in YYYY-MM-DD format');
    }

    if (params.ymd) {
      for (const d of params.ymd) {
        if (!/^\d{8}$/.test(d)) {
          throw new ConnpassValidationError('ymd must be an array of dates in YYYYMMDD format');
        }
      }
    }
  }

  static validateGroupSearchParams(params: GroupSearchParams): void {
    if (params.count !== undefined && (params.count < 1 || params.count > 100)) {
      throw new ConnpassValidationError('Count must be between 1 and 100');
    }

    if (params.start !== undefined && params.start < 1) {
      throw new ConnpassValidationError('Start must be greater than 0');
    }

    if (params.order !== undefined && ![1, 2, 3].includes(params.order)) {
      throw new ConnpassValidationError('Order must be 1 (updated_at desc), 2 (started_at asc), or 3 (started_at desc)');
    }

    if (params.groupId && params.groupId.some(id => id <= 0)) {
      throw new ConnpassValidationError('All group IDs must be positive numbers');
    }
  }

  static validateUserSearchParams(params: UserSearchParams): void {
    if (params.count !== undefined && (params.count < 1 || params.count > 100)) {
      throw new ConnpassValidationError('Count must be between 1 and 100');
    }

    if (params.start !== undefined && params.start < 1) {
      throw new ConnpassValidationError('Start must be greater than 0');
    }

    if (params.order !== undefined && ![1, 2, 3].includes(params.order)) {
      throw new ConnpassValidationError('Order must be 1 (updated_at desc), 2 (started_at asc), or 3 (started_at desc)');
    }

    if (params.userId && params.userId.some(id => id <= 0)) {
      throw new ConnpassValidationError('All user IDs must be positive numbers');
    }
  }

  static validatePositiveInteger(value: number, fieldName: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ConnpassValidationError(`${fieldName} must be a positive integer`);
    }
  }

  static validateNickname(value: string, fieldName: string = 'nickname'): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ConnpassValidationError(`${fieldName} must be a non-empty string`);
    }
  }
}
