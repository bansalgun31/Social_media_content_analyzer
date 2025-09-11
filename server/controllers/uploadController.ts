import { Request, Response } from 'express';
import { storage } from '../storage';
import { parsePDF } from '../utils/pdfParser';
import { performOCR } from '../utils/ocrParser';
import { InsertFileProcessingResult } from '@shared/schema';
import { validateFile } from '../utils/fileValidator';
import { parseDocx } from '../utils/docxParser';
import { parseTxt } from '../utils/txtParser';
import { cleanExtractedText, analyzeText } from '../utils/textProcessor';

export const uploadController = {
  async handleUpload(req: Request, res: Response) {
    try {
      const files = req.files as any[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          message: 'No files uploaded',
          error: 'At least one file is required'
        });
      }

      const results = [];

      for (const file of files) {
        const startTime = Date.now();
        
        // Enhanced file validation
        const validationResult = validateFile(file);
        if (!validationResult.isValid) {
          const errorResult: InsertFileProcessingResult = {
            filename: `${Date.now()}-${file.originalname}`,
            originalName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            status: 'failed',
            extractedText: null,
            wordCount: null,
            characterCount: null,
            processingTime: Date.now() - startTime,
            errorMessage: validationResult.error || 'File validation failed',
            metadata: {
              uploadedAt: new Date().toISOString(),
              failedAt: new Date().toISOString(),
              validationError: validationResult.error,
              fileSignature: validationResult.fileSignature
            }
          };
          
          const savedErrorResult = await storage.createFileProcessingResult(errorResult);
          results.push(savedErrorResult);
          continue;
        }
        
        // Create initial processing result
        const initialResult: InsertFileProcessingResult = {
          filename: `${Date.now()}-${file.originalname}`,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: 'processing',
          extractedText: null,
          wordCount: null,
          characterCount: null,
          processingTime: null,
          errorMessage: null,
          metadata: {
            uploadedAt: new Date().toISOString()
          }
        };

        const processingResult = await storage.createFileProcessingResult(initialResult);

        try {
          let extractedText = '';

          // Process based on file type
          let rawText = '';
          let sourceType: 'pdf' | 'ocr' | 'docx' | 'txt';
          
          if (file.mimetype === 'application/pdf') {
            rawText = await parsePDF(file.buffer);
            sourceType = 'pdf';
          } else if (file.mimetype.startsWith('image/')) {
            rawText = await performOCR(file.buffer);
            sourceType = 'ocr';
          } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            rawText = await parseDocx(file.buffer);
            sourceType = 'docx';
          } else if (file.mimetype === 'text/plain') {
            rawText = await parseTxt(file.buffer);
            sourceType = 'txt';
          } else {
            throw new Error('Unsupported file type');
          }
          
          // Clean and preprocess the extracted text
          extractedText = cleanExtractedText(rawText, sourceType);
          
          // Analyze the text for additional insights
          const textAnalysis = analyzeText(extractedText, {
            detectLanguage: true,
            detectPII: true,
            extractTopics: true
          });

          // Calculate metrics
          const wordCount = extractedText.trim().split(/\s+/).filter(word => word.length > 0).length;
          const characterCount = extractedText.length;
          const processingTime = Date.now() - startTime;

          // Update with success
          const updatedResult = await storage.updateFileProcessingResult(processingResult.id, {
            status: 'completed',
            extractedText,
            wordCount,
            characterCount,
            processingTime,
            metadata: Object.assign(
              initialResult.metadata || {},
              { completedAt: new Date().toISOString() }
            )
          });

          results.push(updatedResult);

        } catch (error) {
          const processingTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';

          // Update with error
          const updatedResult = await storage.updateFileProcessingResult(processingResult.id, {
            status: 'failed',
            processingTime,
            errorMessage,
            metadata: Object.assign(
              initialResult.metadata || {},
              {
                failedAt: new Date().toISOString(),
                error: errorMessage
              }
            )
          });

          results.push(updatedResult);
        }
      }

      res.json({
        message: `Processed ${files.length} file(s)`,
        results: results
      });

    } catch (error) {
      console.error('Upload error:', error);
      
      res.status(500).json({
        message: 'Failed to process uploaded files',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};
