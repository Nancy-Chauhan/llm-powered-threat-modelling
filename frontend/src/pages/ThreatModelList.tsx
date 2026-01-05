import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useThreatModelStore } from '@/store/threat-model-store';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export function ThreatModelList() {
  const {
    threatModels,
    total,
    page,
    isLoading,
    error,
    fetchThreatModels,
    deleteThreatModel,
  } = useThreatModelStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchThreatModels(1, search || undefined, statusFilter || undefined);
  }, [fetchThreatModels, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchThreatModels(1, search || undefined, statusFilter || undefined);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this threat model?')) {
      await deleteThreatModel(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Threat Models</h1>
          <p className="text-muted-foreground">
            Manage and view your threat models
          </p>
        </div>
        <Link to="/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Threat Model
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search threat models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="generating">Generating</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : threatModels.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No threat models found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first threat model
          </p>
          <Link to="/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Threat Model
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {threatModels.map((model) => (
            <Link
              key={model.id}
              to={`/threat-models/${model.id}`}
              className="block p-4 border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{model.title}</h3>
                    <StatusBadge status={model.status} />
                  </div>
                  {model.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {model.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(model.updatedAt).toLocaleDateString()}
                    </span>
                    {model.threatCount > 0 && (
                      <span>{model.threatCount} threats</span>
                    )}
                    {model.highestSeverity && (
                      <SeverityBadge severity={model.highestSeverity} size="sm" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(model.id, e)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > threatModels.length && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => fetchThreatModels(page - 1, search, statusFilter)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => fetchThreatModels(page + 1, search, statusFilter)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
