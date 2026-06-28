import React, { useState } from 'react';
import { CheckSquare, Square, Trash2, Send, Check, Tag, Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BATCH_OPERATIONS, BatchOperation } from '@/lib/batchOperations';

interface BatchOperationsUIProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExecuteOperation: (
    operation: string,
    params?: Record<string, any>
  ) => Promise<void>;
  isLoading?: boolean;
}

interface ConfirmDialogState {
  isOpen: boolean;
  operation?: BatchOperation;
  params?: Record<string, any>;
}

const getOperationIcon = (operationId: string) => {
  switch (operationId) {
    case 'transfer':
      return <Send className="w-4 h-4" />;
    case 'verify':
      return <Check className="w-4 h-4" />;
    case 'delete':
      return <Trash2 className="w-4 h-4" />;
    case 'export':
      return <Download className="w-4 h-4" />;
    case 'tag':
      return <Tag className="w-4 h-4" />;
    default:
      return null;
  }
};

export const BatchOperationsUI: React.FC<BatchOperationsUIProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onExecuteOperation,
  isLoading = false,
}) => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
  });
  const [tagInput, setTagInput] = useState('');

  const handleOperationClick = (operation: BatchOperation) => {
    if (operation.requiresConfirmation) {
      setConfirmDialog({
        isOpen: true,
        operation,
      });
    } else if (operation.id === 'tag') {
      setConfirmDialog({
        isOpen: true,
        operation,
        params: { tag: tagInput },
      });
    } else {
      executeOperation(operation);
    }
  };

  const executeOperation = async (operation: BatchOperation) => {
    try {
      await onExecuteOperation(operation.id, confirmDialog.params);
      setConfirmDialog({ isOpen: false });
      setTagInput('');
    } catch (error) {
      console.error('Operation failed:', error);
    }
  };

  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const hasSelection = selectedCount > 0;

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
            title={isAllSelected ? 'Deselect all' : 'Select all'}
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} of {totalCount} selected
          </span>
        </div>
        {hasSelection && (
          <button
            onClick={onDeselectAll}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Batch Operations */}
      {hasSelection && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Batch Actions</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {BATCH_OPERATIONS.map((operation) => (
              <button
                key={operation.id}
                onClick={() => handleOperationClick(operation)}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  operation.id === 'delete'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 disabled:bg-red-50 disabled:opacity-50'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100 disabled:opacity-50'
                )}
              >
                {getOperationIcon(operation.id)}
                <span>{operation.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag Input (shown when tag operation is selected) */}
      {confirmDialog.operation?.id === 'tag' && confirmDialog.isOpen && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Enter tag name"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && confirmDialog.operation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm {confirmDialog.operation.name}
            </h3>
            <p className="text-sm text-gray-600">
              {confirmDialog.operation.description}
            </p>
            <p className="text-sm font-medium text-gray-700">
              This will affect {selectedCount} item{selectedCount !== 1 ? 's' : ''}.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog({ isOpen: false })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeOperation(confirmDialog.operation!)}
                disabled={isLoading}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  confirmDialog.operation.id === 'delete'
                    ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                )}
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchOperationsUI;
