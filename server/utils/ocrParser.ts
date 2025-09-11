import { createWorker } from 'tesseract.js';

export async function performOCR(buffer: Buffer): Promise<string> {
  let worker;
  
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty image buffer provided');
    }

    // Create Tesseract worker
    worker = await createWorker();
    
    // Initialize with English language
    await (worker as any).loadLanguage('eng');
    await (worker as any).initialize('eng');
    
    // Configure for better accuracy
    await (worker as any).setParameters({
      tessedit_page_seg_mode: '1', // Automatic page segmentation with OSD
      tessedit_ocr_engine_mode: '2', // LSTM only
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?;:()-"\'\n',
    });

    // Perform OCR
    const { data: { text, confidence } } = await (worker as any).recognize(buffer);
    
    // Check if confidence is too low
    if (confidence < 30) {
      throw new Error(`Image quality too low for accurate text recognition (confidence: ${confidence.toFixed(1)}%). Please upload a higher resolution image with clearer text.`);
    }

    // Clean up the extracted text
    const cleanedText = text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/[^\w\s.,!?;:()'""\-\n]/g, '') // Remove unusual characters
      .trim();

    if (!cleanedText || cleanedText.length < 3) {
      throw new Error('No readable text found in the image. Please ensure the image contains clear, readable text.');
    }

    return cleanedText;

  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific error messages based on common OCR issues
      if (error.message.includes('Invalid image')) {
        throw new Error('Invalid image format. Please upload a PNG, JPG, or JPEG file.');
      }
      if (error.message.includes('confidence')) {
        throw error; // Re-throw confidence errors as-is
      }
      throw new Error(`OCR processing failed: ${error.message}`);
    }
    throw new Error('Unknown error occurred during OCR processing');
  } finally {
    // Clean up worker
    if (worker) {
      await (worker as any).terminate();
    }
  }
}
