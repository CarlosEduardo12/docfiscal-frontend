/**
 * Comprehensive FileUploadValidator with type, size, and integrity checks
 * Implements Requirements 3.1, 3.2 from frontend-issues-resolution spec
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export class FileUploadValidator {
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly supportedTypes = ['application/pdf'];
  private readonly supportedFormats = ['PDF'];

  /**
   * Validates a file against type, size, and basic integrity checks
   */
  validateFile(file: File): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    if (!this.supportedTypes.includes(file.type)) {
      errors.push('Apenas arquivos PDF são permitidos');
    }

    // Size validation
    if (file.size > this.maxFileSize) {
      errors.push('Arquivo deve ter no máximo 100MB');
    }

    // Empty file check
    if (file.size === 0) {
      errors.push('Arquivo está vazio ou corrompido');
    }

    // File name validation
    if (!file.name || file.name.trim().length === 0) {
      errors.push('Arquivo deve ter um nome válido');
    }

    // Extension validation
    if (file.name && !file.name.toLowerCase().endsWith('.pdf')) {
      warnings.push('Arquivo não possui extensão .pdf');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validates file integrity by checking PDF header
   */
  async validateFileIntegrity(file: File): Promise<boolean> {
    try {
      // Read first few bytes to check PDF header
      const arrayBuffer = await file.slice(0, 8).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const header = String.fromCharCode(...uint8Array);

      // Check for PDF magic number
      return header.startsWith('%PDF-');
    } catch (error) {
      console.error('Error validating file integrity:', error);
      return false;
    }
  }

  /**
   * Returns list of supported file formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Returns maximum allowed file size in bytes
   */
  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  /**
   * Returns human-readable file size limit
   */
  getMaxFileSizeFormatted(): string {
    const mb = this.maxFileSize / (1024 * 1024);
    return `${mb}MB`;
  }

  /**
   * Validates multiple files at once
   */
  validateFiles(files: File[]): ValidationResult[] {
    return files.map(file => this.validateFile(file));
  }

  /**
   * Checks if all files in array are valid
   */
  areAllFilesValid(files: File[]): boolean {
    return this.validateFiles(files).every(result => result.isValid);
  }

  /**
   * Gets comprehensive validation summary for multiple files
   */
  getValidationSummary(files: File[]): {
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
    totalErrors: number;
    totalWarnings: number;
  } {
    const results = this.validateFiles(files);
    
    return {
      totalFiles: files.length,
      validFiles: results.filter(r => r.isValid).length,
      invalidFiles: results.filter(r => !r.isValid).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0)
    };
  }
}