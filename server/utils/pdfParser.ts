import pdf from 'pdf-parse';

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty PDF buffer provided');
    }

    const data = await pdf(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text content found in PDF. The PDF might be image-based or corrupted.');
    }

    // Clean up the extracted text
    const cleanedText = data.text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .trim();

    return cleanedText;

  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid PDF file format. Please ensure the file is a valid PDF.');
      }
      if (error.message.includes('Password')) {
        throw new Error('Password-protected PDFs are not supported. Please provide an unlocked PDF.');
      }
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
    throw new Error('Unknown error occurred while parsing PDF');
  }
}
