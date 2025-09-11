import { createHash } from 'crypto';

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileSignature?: string;
}

interface FileSignature {
  signature: string;
  offset: number;
  mimeTypes: string[];
}

// File signature database for validation
const FILE_SIGNATURES: FileSignature[] = [
  { signature: '255044462D', offset: 0, mimeTypes: ['application/pdf'] }, // PDF
  { signature: '89504E47', offset: 0, mimeTypes: ['image/png'] }, // PNG
  { signature: 'FFD8FF', offset: 0, mimeTypes: ['image/jpeg', 'image/jpg'] }, // JPEG
  { signature: '504B0304', offset: 0, mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] }, // DOCX
  { signature: '504B0506', offset: 0, mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] }, // DOCX (empty)
];

// Suspicious file patterns that should be rejected
const SUSPICIOUS_PATTERNS = [
  /\.(exe|bat|cmd|scr|pif|com)$/i, // Executables
  /\.(js|vbs|ps1|sh)$/i, // Scripts
  /\.(dll|sys|bin)$/i, // System files
];

// Maximum file sizes by type (in bytes)
const MAX_FILE_SIZES = {
  'application/pdf': 25 * 1024 * 1024, // 25MB for PDFs
  'image/png': 10 * 1024 * 1024, // 10MB for images
  'image/jpeg': 10 * 1024 * 1024,
  'image/jpg': 10 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 15 * 1024 * 1024, // 15MB for DOCX
  'text/plain': 5 * 1024 * 1024, // 5MB for text files
};

export function validateFile(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }): FileValidationResult {
  // Check for suspicious file extensions
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(file.originalname)) {
      return {
        isValid: false,
        error: `File type '${file.originalname.split('.').pop()}' is not allowed for security reasons`
      };
    }
  }

  // Check file size limits by MIME type
  const maxSize = MAX_FILE_SIZES[file.mimetype as keyof typeof MAX_FILE_SIZES];
  if (maxSize && file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      isValid: false,
      error: `File size ${Math.round(file.size / (1024 * 1024))}MB exceeds the limit of ${maxSizeMB}MB for ${file.mimetype}`
    };
  }

  // Validate file signature against MIME type
  const signatureResult = validateFileSignature(file.buffer, file.mimetype);
  if (!signatureResult.isValid) {
    return signatureResult;
  }

  // Simulate virus scanning (in production, integrate with actual antivirus)
  const virusCheckResult = simulateVirusScan(file.buffer, file.originalname);
  if (!virusCheckResult.isValid) {
    return virusCheckResult;
  }

  return { isValid: true, fileSignature: signatureResult.fileSignature };
}

function validateFileSignature(buffer: Buffer, mimeType: string): FileValidationResult {
  if (buffer.length < 4) {
    return { isValid: false, error: 'File is too small to validate' };
  }

  // Get the first few bytes as hex string
  const headerHex = buffer.slice(0, 10).toString('hex').toUpperCase();
  
  // Find matching signatures
  for (const sig of FILE_SIGNATURES) {
    if (headerHex.startsWith(sig.signature) && sig.mimeTypes.includes(mimeType)) {
      return { isValid: true, fileSignature: sig.signature };
    }
  }

  // Special case for text files (no specific signature)
  if (mimeType === 'text/plain') {
    // Check if file contains mostly printable ASCII characters
    const sampleSize = Math.min(1000, buffer.length);
    const sample = buffer.slice(0, sampleSize);
    let printableChars = 0;
    
    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i];
      // Count printable ASCII characters (32-126) and common whitespace (9, 10, 13)
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        printableChars++;
      }
    }
    
    const textRatio = printableChars / sample.length;
    if (textRatio >= 0.8) { // At least 80% printable characters
      return { isValid: true, fileSignature: 'TEXT' };
    } else {
      return { isValid: false, error: 'File does not appear to be a valid text file' };
    }
  }

  return {
    isValid: false,
    error: `File signature does not match declared MIME type '${mimeType}'. This could indicate a renamed or corrupted file.`
  };
}

function simulateVirusScan(buffer: Buffer, filename: string): FileValidationResult {
  // Simulate basic virus scanning checks
  const fileHash = createHash('md5').update(buffer).digest('hex');
  
  // Known malicious patterns (simplified simulation)
  const maliciousPatterns = [
    /EICAR/i, // EICAR test string
    /X5O!P%@AP/i, // EICAR signature
    /<script[^>]*>.*virus.*<\/script>/i, // Basic script injection
  ];
  
  const fileContent = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(fileContent) || pattern.test(filename)) {
      return {
        isValid: false,
        error: 'File failed security scan. Potential malicious content detected.'
      };
    }
  }
  
  // Check for suspicious file characteristics
  if (buffer.length === 0) {
    return { isValid: false, error: 'Empty files are not allowed' };
  }
  
  // Check for extremely large files that might be zip bombs
  if (buffer.length > 100 * 1024 * 1024) { // 100MB
    return { isValid: false, error: 'File too large for security processing' };
  }
  
  return { isValid: true };
}

export function getFileTypeInfo(mimeType: string): { category: string; maxSize: number; description: string } {
  const sizeInMB = (bytes: number) => Math.round(bytes / (1024 * 1024));
  
  switch (mimeType) {
    case 'application/pdf':
      return {
        category: 'document',
        maxSize: sizeInMB(MAX_FILE_SIZES['application/pdf']),
        description: 'PDF Document'
      };
    case 'image/png':
    case 'image/jpeg':
    case 'image/jpg':
      return {
        category: 'image',
        maxSize: sizeInMB(MAX_FILE_SIZES['image/png']),
        description: 'Image File'
      };
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return {
        category: 'document',
        maxSize: sizeInMB(MAX_FILE_SIZES['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
        description: 'Word Document'
      };
    case 'text/plain':
      return {
        category: 'text',
        maxSize: sizeInMB(MAX_FILE_SIZES['text/plain']),
        description: 'Text File'
      };
    default:
      return {
        category: 'unknown',
        maxSize: 10,
        description: 'Unknown File Type'
      };
  }
}