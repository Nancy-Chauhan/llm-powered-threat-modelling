import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  FileText,
  Image,
  File,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useThreatModelStore } from '@/store/threat-model-store';
import { cn } from '@/lib/utils';
import { JiraInput, type JiraTicket } from '@/components/JiraInput';
import { JiraPreview } from '@/components/JiraPreview';

type WizardStep = 'basics' | 'context' | 'review';

const STEPS: { id: WizardStep; title: string; description: string }[] = [
  { id: 'basics', title: 'Basics', description: 'Name and describe your project' },
  { id: 'context', title: 'Context', description: 'Add JIRA tickets, PRDs, diagrams' },
  { id: 'review', title: 'Review', description: 'Review and generate' },
];

export function CreateThreatModel() {
  const navigate = useNavigate();
  const {
    createThreatModel,
    uploadFile,
    generateThreatModel,
    pollGenerationStatus,
    generationStatus,
    isGenerating,
    error,
    clearError,
  } = useThreatModelStore();

  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemDescription, setSystemDescription] = useState('');
  const [files, setFiles] = useState<Array<{ file: File; type: string }>>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);

  useEffect(() => {
    clearError(); // Clear any previous errors
  }, [clearError]);

  // Poll generation status
  useEffect(() => {
    if (!modelId || !isGenerating) return;

    const interval = setInterval(async () => {
      const status = await pollGenerationStatus(modelId);
      if (status.status === 'completed') {
        navigate(`/threat-models/${modelId}`);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [modelId, isGenerating, pollGenerationStatus, navigate]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      type: getFileType(file),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.md'],
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/json': ['.json'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleJiraTicketAdded = (ticket: JiraTicket) => {
    // Prevent duplicates
    if (!jiraTickets.find((t) => t.issueKey === ticket.issueKey)) {
      setJiraTickets((prev) => [...prev, ticket]);
    }
  };

  const removeJiraTicket = (issueKey: string) => {
    setJiraTickets((prev) => prev.filter((t) => t.issueKey !== issueKey));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'basics':
        return title.trim().length > 0;
      case 'context':
        return true; // Optional
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    clearError(); // Clear any previous errors when navigating
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  };

  const handleBack = () => {
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create threat model
      const model = await createThreatModel({
        title,
        description,
        systemDescription,
      });

      setModelId(model.id);

      // Add JIRA tickets
      for (const ticket of jiraTickets) {
        await fetch(`http://localhost:3001/api/threat-models/${model.id}/jira-tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueKeyOrUrl: ticket.issueKey }),
        });
      }

      // Upload files
      for (const { file, type } of files) {
        await uploadFile(model.id, file, type);
      }

      // Start generation
      await generateThreatModel(model.id);
      toast.success('Threat model created successfully');
    } catch (err) {
      console.error('Failed to create threat model:', err);
      toast.error('Failed to create threat model');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => index < currentStepIndex && setCurrentStep(step.id)}
                disabled={index > currentStepIndex}
                className={cn(
                  'flex items-center gap-2',
                  index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    index < currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : index === currentStepIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                  )}
                >
                  {index + 1}
                </span>
                <span className="hidden sm:block text-sm font-medium">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-2',
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">{STEPS[currentStepIndex].title}</h2>
        <p className="text-muted-foreground mb-6">{STEPS[currentStepIndex].description}</p>

        {currentStep === 'basics' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., User Authentication System"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project or feature..."
                className="w-full px-3 py-2 border rounded-md bg-background resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">System Description</label>
              <textarea
                value={systemDescription}
                onChange={(e) => setSystemDescription(e.target.value)}
                placeholder="Detailed technical description of the system architecture, components, data flows..."
                className="w-full px-3 py-2 border rounded-md bg-background resize-none"
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include details about architecture, technologies, data handling, etc.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'context' && (
          <div className="space-y-6">
            {/* JIRA Tickets Section */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">JIRA Tickets</h4>
                <JiraInput onTicketAdded={handleJiraTicketAdded} />
              </div>

              {jiraTickets.length > 0 && (
                <div className="space-y-2">
                  {jiraTickets.map((ticket) => (
                    <JiraPreview
                      key={ticket.issueKey}
                      ticket={ticket}
                      onRemove={() => removeJiraTicket(ticket.issueKey)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Additional Files (Optional)
                </span>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDFs, images (PNG, JPG, GIF, WebP), and text files (TXT, MD, JSON)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Files are sent directly to the AI for analysis
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Uploaded Files</h4>
                  {files.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-muted rounded-md"
                    >
                      {getFileIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)} · {item.type}
                        </p>
                      </div>
                      <select
                        value={item.type}
                        onChange={(e) => {
                          const newFiles = [...files];
                          newFiles[index].type = e.target.value;
                          setFiles(newFiles);
                        }}
                        className="text-xs px-2 py-1 border rounded bg-background"
                      >
                        <option value="prd">PRD</option>
                        <option value="diagram">Diagram</option>
                        <option value="screenshot">Screenshot</option>
                        <option value="other">Other</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            {isGenerating ? (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <h3 className="font-medium mb-2">Generating Threat Model</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {generationStatus?.message || 'Analyzing your system and identifying threats...'}
                </p>
                <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${generationStatus?.progress || 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Project</h4>
                  <p className="font-medium">{title}</p>
                  {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                </div>

                {systemDescription && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">System Description</h4>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                      {systemDescription.substring(0, 500)}
                      {systemDescription.length > 500 && '...'}
                    </p>
                  </div>
                )}

                {jiraTickets.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      JIRA Tickets ({jiraTickets.length})
                    </h4>
                    <div className="space-y-2">
                      {jiraTickets.map((ticket) => (
                        <div
                          key={ticket.issueKey}
                          className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md"
                        >
                          <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            {ticket.issueKey}
                          </span>
                          <span className="text-sm truncate">{ticket.title}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {ticket.comments.length} comments
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {files.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Context Files ({files.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {files.map((item, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                        >
                          {getFileIcon(item.type)}
                          {item.file.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0 || isGenerating}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep === 'review' ? (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || isSubmitting || isGenerating}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Threat Model
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

function getFileType(file: File): string {
  if (file.type.startsWith('image/')) return 'screenshot';
  if (file.name.endsWith('.pdf')) return 'prd';
  if (file.name.endsWith('.md') || file.name.endsWith('.txt')) return 'prd';
  return 'other';
}

function getFileIcon(type: string) {
  switch (type) {
    case 'prd':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'screenshot':
    case 'diagram':
      return <Image className="h-4 w-4 text-green-500" />;
    default:
      return <File className="h-4 w-4 text-gray-500" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
