export async function parseTxt(buffer: Buffer): Promise<string> {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty text buffer provided');
    }

    // Try different encodings to handle various text files
    let text: string;
    
    // First try UTF-8
    try {
      text = buffer.toString('utf8');
      // Check if it contains replacement characters, indicating encoding issues
      if (text.includes('\uFFFD')) {
        throw new Error('UTF-8 decoding failed');
      }
    } catch {
      // Fallback to Latin-1 (ISO-8859-1) for older files
      try {
        text = buffer.toString('latin1');
      } catch {
        // Final fallback to ASCII
        text = buffer.toString('ascii');
      }
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in file. The file might be empty.');
    }

    // Clean up the extracted text
    const cleanedText = text
      .replace(/\r\n/g, '\n')  // Normalize Windows line endings
      .replace(/\r/g, '\n')   // Normalize Mac line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/\t/g, '    ')  // Replace tabs with 4 spaces for consistency
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \n
      .trim();

    // Validate that the content is primarily text
    const printableRatio = calculatePrintableRatio(cleanedText);
    if (printableRatio < 0.8) {
      throw new Error('File does not appear to be a valid text file. It may be binary or corrupted.');
    }

    return cleanedText;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Text parsing failed: ${error.message}`);
    }
    throw new Error('Unknown error occurred while parsing text file');
  }
}

function calculatePrintableRatio(text: string): number {
  if (text.length === 0) return 0;
  
  let printableChars = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Count printable characters (including common whitespace)
    if (
      (charCode >= 32 && charCode <= 126) || // Printable ASCII
      charCode === 9 ||  // Tab
      charCode === 10 || // Line feed
      charCode === 13 || // Carriage return
      (charCode >= 128 && charCode <= 255) // Extended ASCII
    ) {
      printableChars++;
    }
  }
  
  return printableChars / text.length;
}