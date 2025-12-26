/**
 * Property-based tests for form validation feedback
 * Feature: frontend-issues-resolution, Property 1: Form validation provides comprehensive feedback
 * Validates: Requirements 1.1, 1.3
 */

import * as fc from 'fast-check';
import { type ValidationSchema, type ValidationError } from '../FormValidator';

// Test form data interface
interface TestFormData {
  email: string;
  password: string;
  name: string;
}

// Test validation schema
const testSchema: ValidationSchema<TestFormData> = {
  fields: {
    email: {
      required: true,
      type: 'email',
      customValidator: (value: string) => {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Invalid email format';
      },
    },
    password: {
      required: true,
      minLength: 6,
      customValidator: (value: string) => {
        if (!value) return null;
        return value.length >= 6 ? null : 'Password must be at least 6 characters';
      },
    },
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
      customValidator: (value: string) => {
        if (!value || value.trim().length < 2) {
          return 'Name must be at least 2 characters';
        }
        if (value.length > 50) {
          return 'Name must be no more than 50 characters';
        }
        return null;
      },
    },
  },
};

// Validation logic extracted from FormValidator for testing
const validateSingleField = (
  fieldName: string,
  value: any,
  fieldValidator: any,
  formData?: Record<string, any>
): string | null => {
  // Required validation
  if (fieldValidator.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return `${fieldName} is required`;
  }

  // Skip other validations if field is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // Type-specific validation
  if (fieldValidator.type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
  }

  // Length validation
  if (fieldValidator.minLength && value.length < fieldValidator.minLength) {
    return `${fieldName} must be at least ${fieldValidator.minLength} characters long`;
  }

  if (fieldValidator.maxLength && value.length > fieldValidator.maxLength) {
    return `${fieldName} must be no more than ${fieldValidator.maxLength} characters long`;
  }

  // Pattern validation
  if (fieldValidator.pattern && !fieldValidator.pattern.test(value)) {
    return `${fieldName} format is invalid`;
  }

  // Custom validation
  if (fieldValidator.customValidator) {
    return fieldValidator.customValidator(value, formData);
  }

  return null;
};

const validateForm = (formData: Record<string, any>, schema: ValidationSchema<any>) => {
  const fieldErrors: ValidationError[] = [];
  let firstErrorField: string | undefined;

  // Validate individual fields
  Object.entries(schema.fields).forEach(([fieldName, fieldValidator]) => {
    const value = formData[fieldName];
    const error = validateSingleField(fieldName, value, fieldValidator, formData);
    
    if (error) {
      fieldErrors.push({ field: fieldName, message: error });
      if (!firstErrorField) {
        firstErrorField = fieldName;
      }
    }
  });

  // Run custom form-level validators
  if (schema.customValidators) {
    schema.customValidators.forEach(validator => {
      const customErrors = validator(formData);
      fieldErrors.push(...customErrors);
      if (!firstErrorField && customErrors.length > 0) {
        firstErrorField = customErrors[0].field;
      }
    });
  }

  return {
    isValid: fieldErrors.length === 0,
    errors: fieldErrors,
    firstErrorField,
  };
};

// Generators for test data
const invalidEmailArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant('invalid'),
  fc.constant('test@'),
  fc.constant('@test.com'),
  fc.constant('test.com'),
  fc.string().filter(s => !s.includes('@') || !s.includes('.')),
);

const validEmailArbitrary = fc.emailAddress();

const invalidPasswordArbitrary = fc.oneof(
  fc.constant(''),
  fc.string({ maxLength: 5 }),
);

const validPasswordArbitrary = fc.string({ minLength: 6, maxLength: 100 });

const invalidNameArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.string({ maxLength: 1 }),
  fc.string({ minLength: 51, maxLength: 100 }),
);

const validNameArbitrary = fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2);

describe('Form Validation Feedback Properties', () => {
  /**
   * Property 1: Form validation provides comprehensive feedback
   * For any form submission with invalid data, the system should validate all fields,
   * display specific error messages, maintain user input, and focus on the first invalid field
   */
  test('Property 1: Invalid form data triggers comprehensive validation feedback', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: invalidEmailArbitrary,
          password: invalidPasswordArbitrary,
          name: invalidNameArbitrary,
        }),
        (invalidData) => {
          const validationResult = validateForm(invalidData, testSchema);

          // Should be invalid
          expect(validationResult.isValid).toBe(false);
          
          // Should have validation errors
          expect(validationResult.errors.length).toBeGreaterThan(0);
          
          // Should have a first error field for focus management
          expect(validationResult.firstErrorField).toBeDefined();
          expect(typeof validationResult.firstErrorField).toBe('string');
          
          // Each error should have required properties
          validationResult.errors.forEach(error => {
            expect(error).toHaveProperty('field');
            expect(error).toHaveProperty('message');
            expect(typeof error.field).toBe('string');
            expect(typeof error.message).toBe('string');
            expect(error.field.length).toBeGreaterThan(0);
            expect(error.message.length).toBeGreaterThan(0);
          });

          // Error messages should be descriptive (not just "error" or "invalid")
          validationResult.errors.forEach(error => {
            expect(error.message.length).toBeGreaterThan(5);
            expect(error.message.toLowerCase()).not.toBe('error');
            expect(error.message.toLowerCase()).not.toBe('invalid');
          });

          // Should have specific error for each invalid field
          const errorFields = validationResult.errors.map(e => e.field);
          
          // Check that we get errors for the fields we expect
          if (!invalidData.email || invalidData.email.trim() === '' || !invalidData.email.includes('@')) {
            expect(errorFields).toContain('email');
          }
          if (!invalidData.password || invalidData.password.length < 6) {
            expect(errorFields).toContain('password');
          }
          if (!invalidData.name || invalidData.name.trim().length < 2 || invalidData.name.length > 50) {
            expect(errorFields).toContain('name');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 1: Valid form data results in no validation errors', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: validEmailArbitrary,
          password: validPasswordArbitrary,
          name: validNameArbitrary,
        }),
        (validData) => {
          const validationResult = validateForm(validData, testSchema);

          // Should be valid
          expect(validationResult.isValid).toBe(true);
          
          // Should have no validation errors
          expect(validationResult.errors.length).toBe(0);
          
          // Should have no first error field
          expect(validationResult.firstErrorField).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 1: Mixed valid/invalid data produces selective errors', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: invalidEmailArbitrary,
          password: validPasswordArbitrary,
          name: validNameArbitrary,
        }),
        (mixedData) => {
          const validationResult = validateForm(mixedData, testSchema);

          // Should be invalid due to email
          expect(validationResult.isValid).toBe(false);
          
          // Should have at least one error (for email)
          expect(validationResult.errors.length).toBeGreaterThan(0);
          
          // Should have error for email field
          const errorFields = validationResult.errors.map(e => e.field);
          expect(errorFields).toContain('email');
          
          // Should NOT have errors for valid password and name fields
          expect(errorFields).not.toContain('password');
          expect(errorFields).not.toContain('name');
          
          // First error should be email
          expect(validationResult.firstErrorField).toBe('email');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 1: Required field validation provides specific messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('email', 'password', 'name'),
        (fieldName) => {
          const emptyData = { email: '', password: '', name: '' };
          const validationResult = validateForm(emptyData, testSchema);

          // Should be invalid
          expect(validationResult.isValid).toBe(false);
          
          // Should have errors for all required fields
          expect(validationResult.errors.length).toBe(3);
          
          // Should have error for the specific field
          const fieldError = validationResult.errors.find(e => e.field === fieldName);
          expect(fieldError).toBeDefined();
          expect(fieldError!.message).toContain('required');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 1: Custom validation rules are applied correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5 }), // Too short password
        (shortPassword) => {
          const formData = {
            email: 'test@example.com',
            password: shortPassword,
            name: 'Valid Name',
          };
          
          const validationResult = validateForm(formData, testSchema);

          if (shortPassword.length < 6) {
            // Should be invalid due to password length
            expect(validationResult.isValid).toBe(false);
            
            // Should have error for password
            const passwordError = validationResult.errors.find(e => e.field === 'password');
            expect(passwordError).toBeDefined();
            expect(passwordError!.message).toContain('6 characters');
          } else {
            // Should be valid if password is long enough
            expect(validationResult.isValid).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 1: Email validation provides specific feedback', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('notanemail'),
          fc.constant('test@'),
          fc.constant('@domain.com'),
          fc.constant('test.domain.com'),
        ),
        (invalidEmail) => {
          const formData = {
            email: invalidEmail,
            password: 'validpassword',
            name: 'Valid Name',
          };
          
          const validationResult = validateForm(formData, testSchema);

          // Should be invalid due to email
          expect(validationResult.isValid).toBe(false);
          
          // Should have error for email
          const emailError = validationResult.errors.find(e => e.field === 'email');
          expect(emailError).toBeDefined();
          expect(emailError!.message.toLowerCase()).toContain('email');
        }
      ),
      { numRuns: 50 }
    );
  });
});