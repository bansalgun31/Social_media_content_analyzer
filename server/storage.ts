import { type User, type InsertUser, type FileProcessingResult, type InsertFileProcessingResult } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // File processing results methods
  createFileProcessingResult(result: InsertFileProcessingResult): Promise<FileProcessingResult>;
  getFileProcessingResult(id: string): Promise<FileProcessingResult | undefined>;
  getAllFileProcessingResults(): Promise<FileProcessingResult[]>;
  updateFileProcessingResult(id: string, updates: Partial<InsertFileProcessingResult>): Promise<FileProcessingResult | undefined>;
  deleteFileProcessingResult(id: string): Promise<boolean>;
  deleteAllFileProcessingResults(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private fileProcessingResults: Map<string, FileProcessingResult>;

  constructor() {
    this.users = new Map();
    this.fileProcessingResults = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createFileProcessingResult(result: InsertFileProcessingResult): Promise<FileProcessingResult> {
    const id = randomUUID();
    const now = new Date();
    const fileResult: FileProcessingResult = { 
      ...result, 
      id,
      createdAt: now,
      updatedAt: now,
      extractedText: result.extractedText || null,
      wordCount: result.wordCount || null,
      characterCount: result.characterCount || null,
      processingTime: result.processingTime || null,
      errorMessage: result.errorMessage || null,
      metadata: result.metadata || null
    };
    this.fileProcessingResults.set(id, fileResult);
    return fileResult;
  }

  async getFileProcessingResult(id: string): Promise<FileProcessingResult | undefined> {
    return this.fileProcessingResults.get(id);
  }

  async getAllFileProcessingResults(): Promise<FileProcessingResult[]> {
    return Array.from(this.fileProcessingResults.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateFileProcessingResult(id: string, updates: Partial<InsertFileProcessingResult>): Promise<FileProcessingResult | undefined> {
    const existing = this.fileProcessingResults.get(id);
    if (!existing) return undefined;

    const updated: FileProcessingResult = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.fileProcessingResults.set(id, updated);
    return updated;
  }

  async deleteFileProcessingResult(id: string): Promise<boolean> {
    return this.fileProcessingResults.delete(id);
  }

  async deleteAllFileProcessingResults(): Promise<void> {
    this.fileProcessingResults.clear();
  }
}

export const storage = new MemStorage();
