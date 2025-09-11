import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileProcessingResult } from "@shared/schema";
import { ChartLine, CloudUpload, FileText, Image, Check, AlertTriangle, Copy, Download, Trash2, RotateCcw, X, Wifi } from "lucide-react";

export default function Home() {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch all results
  const { data: results = [], isLoading, refetch } = useQuery<FileProcessingResult[]>({
    queryKey: ['/api/results'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const response = await apiRequest('POST', '/api/upload', formData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      toast({
        title: "Upload completed",
        description: `Successfully processed ${data.results?.length || 0} file(s)`,
      });
      setUploadProgress({});
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress({});
    },
  });

  // Delete result mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/results/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      toast({
        title: "Result deleted",
        description: "File result has been removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear all results mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', '/api/results');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      toast({
        title: "All results cleared",
        description: "All file processing results have been removed",
      });
    },
    onError: (error) => {
      toast({
        title: "Clear failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((files: File[]) => {
    if (files.length === 0) return;

    // Validate files
    const validFiles = [];
    const invalidFiles = [];
    
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (too large)`);
        continue;
      }
      
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(`${file.name} (unsupported type)`);
        continue;
      }
      
      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      toast({
        title: "Some files were skipped",
        description: `Invalid files: ${invalidFiles.join(', ')}`,
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      // Simulate progress for UI feedback
      const progressObj: Record<string, number> = {};
      validFiles.forEach(file => {
        progressObj[file.name] = 0;
      });
      setUploadProgress(progressObj);

      uploadMutation.mutate(validFiles);
    }
  }, [uploadMutation, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFileSelect(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "Text has been copied to your clipboard",
      });
    });
  }, [toast]);

  const downloadResult = useCallback((result: FileProcessingResult) => {
    if (!result.extractedText) return;
    
    const blob = new Blob([result.extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.originalName}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatProcessingTime = (ms: number | null) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="text-destructive" />;
    }
    if (mimeType.startsWith('image/')) {
      return <Image className="text-accent" />;
    }
    return <FileText className="text-muted-foreground" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="text-accent text-xs" />;
      case 'failed':
        return <AlertTriangle className="text-destructive text-xs" />;
      default:
        return <div className="spinner h-4 w-4 rounded-full" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <ChartLine className="text-primary-foreground text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Social Media Content Analyzer</h1>
                <p className="text-sm text-muted-foreground">Extract text from PDFs and images</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-accent rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">API Connected</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Upload Zone */}
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">Upload Your Content</h2>
                <p className="text-muted-foreground">Drop your PDF or image files here to extract text content</p>
              </div>
              
              <div className="mt-8">
                <div 
                  className={`upload-zone border-2 border-dashed border-border rounded-lg p-12 text-center transition-all duration-200 hover:border-primary/50 cursor-pointer ${
                    dragOver ? 'dragover' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="upload-zone"
                >
                  <div className="space-y-4">
                    <div className="mx-auto h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                      <CloudUpload className="text-2xl text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-foreground">Drop files here or click to browse</p>
                      <p className="text-sm text-muted-foreground">
                        Supports PDF files and images (PNG, JPG, JPEG)
                        <br />Maximum file size: 10MB
                      </p>
                    </div>
                    <div className="flex justify-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <FileText className="text-destructive" />
                        <span>PDF</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Image className="text-accent" />
                        <span>Images</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFileInputChange}
                  data-testid="file-input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Processing Queue */}
          {(uploadMutation.isPending || Object.keys(uploadProgress).length > 0) && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Processing Queue</h3>
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(uploadProgress).length} file(s)
                  </span>
                </div>
                
                <div className="space-y-4">
                  {Object.entries(uploadProgress).map(([filename, progress]) => (
                    <div key={filename} className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                      <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        {filename.toLowerCase().includes('.pdf') ? (
                          <FileText className="text-destructive" />
                        ) : (
                          <Image className="text-accent" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-foreground truncate">{filename}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-secondary rounded-full h-2">
                            <div 
                              className="progress-bar bg-primary h-2 rounded-full" 
                              style={{ width: `${uploadMutation.isPending ? 50 : 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {uploadMutation.isPending ? '50%' : '100%'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {uploadMutation.isPending ? 'Processing file...' : 'Complete'}
                        </p>
                      </div>
                      <div className="spinner h-4 w-4 rounded-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">Extraction Results</h3>
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Export all results
                    const allText = results
                      .filter(r => r.extractedText)
                      .map(r => `=== ${r.originalName} ===\n\n${r.extractedText}\n\n`)
                      .join('');
                    
                    if (allText) {
                      const blob = new Blob([allText], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'all_extracted_text.txt';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }
                  }}
                  disabled={results.length === 0}
                  data-testid="export-all-button"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={results.length === 0 || clearAllMutation.isPending}
                  data-testid="clear-all-button"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-16">
                <div className="spinner h-8 w-8 rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading results...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4">
                  <FileText className="text-3xl text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No results yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Upload some files to start extracting text content. Your results will appear here.
                </p>
              </div>
            ) : (
              results.map((result) => (
                <Card key={result.id} className={`fade-in ${result.status === 'failed' ? 'border-destructive/20' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                          result.status === 'completed' ? 'bg-accent/10' : 'bg-destructive/10'
                        }`}>
                          {getFileIcon(result.mimeType)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{result.originalName}</h4>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                            <span>{formatFileSize(result.fileSize)}</span>
                            <span>•</span>
                            <span>{formatProcessingTime(result.processingTime)}</span>
                            <span>•</span>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(result.status)}
                              <span className={result.status === 'completed' ? 'text-accent' : result.status === 'failed' ? 'text-destructive' : ''}>
                                {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {result.extractedText && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.extractedText!)}
                              data-testid={`copy-button-${result.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadResult(result)}
                              data-testid={`download-button-${result.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(result.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`delete-button-${result.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {result.status === 'completed' && result.extractedText && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Extracted Content</span>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{result.wordCount} words</span>
                            <span>{result.characterCount} characters</span>
                          </div>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {result.extractedText}
                          </pre>
                        </div>
                      </div>
                    )}

                    {result.status === 'failed' && result.errorMessage && (
                      <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="text-destructive text-sm mt-0.5" />
                          <div>
                            <p className="font-medium text-destructive text-sm">Processing Failed</p>
                            <p className="text-sm text-muted-foreground mt-1">{result.errorMessage}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Powered by Node.js + Express</span>
              <span>•</span>
              <span>PDF parsing & OCR technology</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 bg-accent rounded-full"></div>
                <span>Backend API Status: Online</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
