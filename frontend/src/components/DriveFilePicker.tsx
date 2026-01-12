import { useEffect, useState } from 'react';
import { FileText, Loader2, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOAuthStore } from '@/store/oauth-store';
import { GoogleDriveConnect } from './GoogleDriveConnect';
import { cn } from '@/lib/utils';

interface DriveFilePickerProps {
  selectedFiles: Array<{ id: string; name: string }>;
  onFilesChange: (files: Array<{ id: string; name: string }>) => void;
}

export function DriveFilePicker({ selectedFiles, onFilesChange }: DriveFilePickerProps) {
  const { isGoogleConfigured, isGoogleConnected, driveFiles, isLoadingFiles, fetchDriveFiles, checkGoogleConfigured } = useOAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkGoogleConfigured();
  }, [checkGoogleConfigured]);

  useEffect(() => {
    if (isGoogleConnected) {
      fetchDriveFiles();
    }
  }, [isGoogleConnected, fetchDriveFiles]);

  const handleSearch = () => {
    fetchDriveFiles(searchQuery || undefined);
  };

  const toggleFile = (file: { id: string; name: string }) => {
    const isSelected = selectedFiles.some((f) => f.id === file.id);
    if (isSelected) {
      onFilesChange(selectedFiles.filter((f) => f.id !== file.id));
    } else {
      onFilesChange([...selectedFiles, file]);
    }
  };

  // Don't render if Google OAuth is not configured
  if (!isGoogleConfigured) {
    return null;
  }

  if (!isGoogleConnected) {
    return (
      <div className="border-2 border-dashed rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Connect your Google Drive to import documents
        </p>
        <GoogleDriveConnect />
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Google Drive Files</h4>
        <GoogleDriveConnect />
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {isLoadingFiles ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : driveFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No files found
        </p>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {driveFiles.map((file) => {
            const isSelected = selectedFiles.some((f) => f.id === file.id);
            return (
              <button
                key={file.id}
                onClick={() => toggleFile({ id: file.id, name: file.name })}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                  isSelected ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                )}
              >
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedFiles.length} file(s) selected
        </p>
      )}
    </div>
  );
}
