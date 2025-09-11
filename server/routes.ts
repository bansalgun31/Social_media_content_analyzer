import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import cors from "cors";
import multer from "multer";
import { uploadController } from "./controllers/uploadController";
import { validateFile, getFileTypeInfo } from "./utils/fileValidator";
import { logger } from "./utils/logger";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable CORS for React frontend
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit (dynamic per file type)
    },
    fileFilter: (req: any, file: any, cb: any) => {
      const allowedMimes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type '${file.mimetype}'. Supported types: PDF, images (PNG, JPG, JPEG), Word documents (DOCX), and text files.`));
      }
    }
  });

  // File upload endpoint
  app.post('/api/upload', upload.array('files', 10), uploadController.handleUpload);

  // Get all processing results
  app.get('/api/results', async (req, res) => {
    try {
      const results = await storage.getAllFileProcessingResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to fetch results',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get specific processing result
  app.get('/api/results/:id', async (req, res) => {
    try {
      const result = await storage.getFileProcessingResult(req.params.id);
      if (!result) {
        return res.status(404).json({ message: 'Result not found' });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to fetch result',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete specific result
  app.delete('/api/results/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteFileProcessingResult(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Result not found' });
      }
      res.json({ message: 'Result deleted successfully' });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to delete result',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clear all results
  app.delete('/api/results', async (req, res) => {
    try {
      await storage.deleteAllFileProcessingResults();
      res.json({ message: 'All results cleared successfully' });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to clear results',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Logging and monitoring endpoints
  app.get('/api/logs', async (req, res) => {
    try {
      const { level, category, limit = 100, since } = req.query;
      const logs = logger.getLogs({
        level: level as any,
        category: category as string,
        limit: parseInt(limit as string),
        since: since ? new Date(since as string) : undefined
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to fetch logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/logs/stats', async (req, res) => {
    try {
      const { since } = req.query;
      const stats = logger.getUploadStats(since ? new Date(since as string) : undefined);
      const summary = logger.getLogSummary();
      res.json({ stats, summary });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to fetch log stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/logs', async (req, res) => {
    try {
      logger.clearLogs();
      res.json({ message: 'Logs cleared successfully' });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to clear logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
