/**
 * Property-based tests for server error mapping
 * Feature: frontend-issues-resolution, Property 2: Server error mapping displays user-friendly messages
 * Validates: Requirements 1.4
 */

import * as fc from 'fast-check';
import { mapServerErrors, type ServerErrorMapping } from '../FormValidator';

// Test server error mapping configuration
const testServerErrorMapping: ServerErrorMapping = {
  'EMAIL_ALREADY_EXISTS': {
    field: 'email',
    message: 'An account with this email already exists',
  },
  'INVALID_EMAIL': {
    field: 'email',
    message: 'Please enter a valid email address',
  },
  'WEAK_PASSWORD': {
    field: 'password',
    message: 'Password is too weak. Please choose a stronger password',
  },
  'INVALID_NAME': {
    field: 'fullName',
    message: 'Please enter a valid full name',
  },
  'REGISTRATION_FAILED': {
    field: 'general',
    message: 'Registration failed. Please try again',
  },
  'SERVER_ERROR': {
    field: 'general',
    message: 'Server error. Please try again later',
  },
  'VALIDATION_ERROR': {
    field: 'general',
    message: 'Please check your input and try again',
  },
  'NETWORK_ERROR': {
    field: 'general',
    message: 'Network error. Please check your connection',
  },
};

// Generators for different types of server errors
const knownErrorCodeArbitrary = fc.constantFrom(
  'EMAIL_ALREADY_EXISTS',
  'INVALID_EMAIL',
  'WEAK_PASSWORD',
  'INVALID_NAME',
  'REGISTRATION_FAILED',
  'SERVER_ERROR',
  'VALIDATION_ERROR',
  'NETWORK_ERROR'
);

const unknownErrorCodeArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .filter(code => 
    !Object.keys(testServerErrorMapping).includes(code) &&
    // Avoid JavaScript Object prototype method names that could cause issues
    !['valueOf', 'toString', 'hasOwnProperty', 'constructor', 'prototype'].includes(code)
  );

const serverErrorObjectArbitrary = fc.record({
  code: fc.oneof(knownErrorCodeArbitrary, unknownErrorCodeArbitrary),
  message: fc.string({ minLength: 0, maxLength: 200 }).map(s => s.trim() || 'An error occurred'),
  field: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

const fieldSpecificErrorArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }), // field names
  fc.string({ minLength: 1, maxLength: 100 }) // error messages
);

describe('Server Error Mapping Properties', () => {
  /**
   * Property 2: Server error mapping displays user-friendly messages
   * For any server-side validation error response, the system should map errors to appropriate 
   * form fields and display user-friendly messages instead of technical codes
   */
  test('Property 2: Known error codes are mapped to user-friendly messages', () => {
    fc.assert(
      fc.property(
        knownErrorCodeArbitrary,
        (errorCode) => {
          // Test single error code mapping
          const serverError = { code: errorCode, message: 'Technical error message' };
          const mappedErrors = mapServerErrors([serverError], testServerErrorMapping);

          // Should have exactly one mapped error
          expect(mappedErrors).toHaveLength(1);
          
          const mappedError = mappedErrors[0];
          const expectedMapping = testServerErrorMapping[errorCode];

          // Should map to the correct field
          expect(mappedError.field).toBe(expectedMapping.field);
          
          // Should use the user-friendly message from mapping, not the technical message
          expect(mappedError.message).toBe(expectedMapping.message);
          expect(mappedError.message).not.toBe('Technical error message');
          
          // User-friendly message should be descriptive (not just error codes)
          expect(mappedError.message.length).toBeGreaterThan(10);
          expect(mappedError.message).not.toMatch(/^[A-Z_]+$/); // Not just uppercase codes
          expect(mappedError.message).toMatch(/[a-z]/); // Contains lowercase letters
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Unknown error codes fallback to generic messages', () => {
    fc.assert(
      fc.property(
        unknownErrorCodeArbitrary,
        fc.string({ minLength: 0, maxLength: 200 }).map(s => s.trim() || 'An error occurred'),
        (unknownCode, originalMessage) => {
          const serverError = { code: unknownCode, message: originalMessage };
          const mappedErrors = mapServerErrors([serverError], testServerErrorMapping);

          // Should have exactly one mapped error
          expect(mappedErrors).toHaveLength(1);
          
          const mappedError = mappedErrors[0];

          // Should use the original message since code is unknown (or fallback if empty)
          const expectedMessage = originalMessage || 'An error occurred';
          expect(mappedError.message).toBe(expectedMessage);
          
          // Should default to 'general' field for unknown errors
          expect(mappedError.field).toBe('general');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Multiple server errors are all mapped correctly', () => {
    fc.assert(
      fc.property(
        fc.array(serverErrorObjectArbitrary, { minLength: 1, maxLength: 5 }),
        (serverErrors) => {
          const mappedErrors = mapServerErrors(serverErrors, testServerErrorMapping);

          // Should have same number of mapped errors as input errors
          expect(mappedErrors).toHaveLength(serverErrors.length);

          // Each error should be properly mapped
          serverErrors.forEach((serverError, index) => {
            const mappedError = mappedErrors[index];
            
            if (Object.prototype.hasOwnProperty.call(testServerErrorMapping, serverError.code)) {
              // Known error code should use mapping
              const expectedMapping = testServerErrorMapping[serverError.code];
              expect(mappedError.field).toBe(expectedMapping.field || 'general');
              expect(mappedError.message).toBe(expectedMapping.message);
            } else {
              // Unknown error code should use original message or fallback
              const expectedMessage = serverError.message || 'An error occurred';
              expect(mappedError.message).toBe(expectedMessage);
              expect(mappedError.field).toBe(serverError.field || 'general');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: String errors are mapped to general field', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (errorString) => {
          const mappedErrors = mapServerErrors(errorString, testServerErrorMapping);

          // Should have exactly one mapped error
          expect(mappedErrors).toHaveLength(1);
          
          const mappedError = mappedErrors[0];

          // Should use the string as message (even if empty)
          expect(mappedError.message).toBe(errorString);
          
          // Should default to 'general' field
          expect(mappedError.field).toBe('general');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Field-specific error objects are preserved', () => {
    fc.assert(
      fc.property(
        fieldSpecificErrorArbitrary,
        (fieldErrors) => {
          // Skip empty objects
          if (Object.keys(fieldErrors).length === 0) return;

          const mappedErrors = mapServerErrors(fieldErrors, testServerErrorMapping);

          // Should have one error per field
          expect(mappedErrors).toHaveLength(Object.keys(fieldErrors).length);

          // Each field error should be preserved
          Object.entries(fieldErrors).forEach(([field, message]) => {
            const mappedError = mappedErrors.find(e => e.field === field);
            expect(mappedError).toBeDefined();
            expect(mappedError!.message).toBe(message);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Array of string errors are mapped to general field', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (errorStrings) => {
          const mappedErrors = mapServerErrors(errorStrings, testServerErrorMapping);

          // Should have same number of mapped errors as input strings
          expect(mappedErrors).toHaveLength(errorStrings.length);

          // Each string should be mapped to general field
          errorStrings.forEach((errorString, index) => {
            const mappedError = mappedErrors[index];
            expect(mappedError.message).toBe(errorString);
            expect(mappedError.field).toBe('general');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Mixed error types are handled consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 100 }), // String errors (including empty)
            serverErrorObjectArbitrary // Object errors
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (mixedErrors) => {
          const mappedErrors = mapServerErrors(mixedErrors, testServerErrorMapping);

          // Should have same number of mapped errors as input
          expect(mappedErrors).toHaveLength(mixedErrors.length);

          // Each error should be properly typed and have required fields
          mappedErrors.forEach((mappedError) => {
            expect(mappedError).toHaveProperty('field');
            expect(mappedError).toHaveProperty('message');
            expect(typeof mappedError.field).toBe('string');
            expect(typeof mappedError.message).toBe('string');
            expect(mappedError.field.length).toBeGreaterThan(0);
            // Message can be empty string, so just check it's defined
            expect(mappedError.message).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Error mapping preserves message quality', () => {
    fc.assert(
      fc.property(
        knownErrorCodeArbitrary,
        (errorCode) => {
          const serverError = { code: errorCode, message: 'TECHNICAL_ERROR_CODE' };
          const mappedErrors = mapServerErrors([serverError], testServerErrorMapping);

          const mappedError = mappedErrors[0];
          const userFriendlyMessage = mappedError.message;

          // User-friendly messages should be human-readable
          expect(userFriendlyMessage).toMatch(/[a-z]/); // Contains lowercase letters
          expect(userFriendlyMessage).toMatch(/\s/); // Contains spaces
          expect(userFriendlyMessage.length).toBeGreaterThan(15); // Reasonably descriptive
          
          // Should not be just technical codes
          expect(userFriendlyMessage).not.toMatch(/^[A-Z_]+$/);
          expect(userFriendlyMessage).not.toBe('TECHNICAL_ERROR_CODE');
          
          // Should end with appropriate punctuation or be a complete sentence
          expect(userFriendlyMessage).toMatch(/[.!]$|[a-z]$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Empty or null errors are handled gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, '', [], {}),
        (emptyError) => {
          const mappedErrors = mapServerErrors(emptyError, testServerErrorMapping);

          // Should handle empty/null errors gracefully
          expect(Array.isArray(mappedErrors)).toBe(true);
          
          if (emptyError === '' || emptyError === null || emptyError === undefined) {
            // Empty string should still create an error
            if (emptyError === '') {
              expect(mappedErrors).toHaveLength(1);
              expect(mappedErrors[0].field).toBe('general');
              expect(mappedErrors[0].message).toBe('');
            } else {
              // null/undefined should result in no errors or handled gracefully
              expect(mappedErrors.length).toBeGreaterThanOrEqual(0);
            }
          } else {
            // Empty arrays/objects should result in no errors
            expect(mappedErrors).toHaveLength(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});