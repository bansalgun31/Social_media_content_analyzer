import mammoth from 'mammoth';

export async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty DOCX buffer provided');
    }

    // Use mammoth to extract text from DOCX
    const result = await mammoth.extractRawText({ buffer });
    
    if (!result.value || result.value.trim().length === 0) {
      throw new Error('No text content found in DOCX file. The document might be empty or corrupted.');
    }

    // Clean up the extracted text
    const cleanedText = result.value
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/\t+/g, ' ')  // Replace tabs with spaces
      .replace(/ {2,}/g, ' ')  // Replace multiple spaces with single space
      .trim();

    // Log warnings if any
    if (result.messages && result.messages.length > 0) {
      console.warn('DOCX parsing warnings:', result.messages.map(m => m.message));
    }

    return cleanedText;

  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('Invalid')) {
        throw new Error('Invalid DOCX file format. Please ensure the file is a valid Word document.');
      }
      if (error.message.includes('ZIP')) {
        throw new Error('DOCX file appears to be corrupted. Word documents should be valid ZIP archives.');
      }
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
    throw new Error('Unknown error occurred while parsing DOCX');
  }
}