import React from 'react';
import { CheckCircle, Lock, Calendar, FileText } from 'lucide-react';

interface ConfirmationBannerProps {
  isLocked: boolean;
  timestamp: Date | null;
  projectId?: string;
  onDownload?: () => void;
}

const ConfirmationBanner: React.FC<ConfirmationBannerProps> = ({
  isLocked,
  timestamp,
  projectId,
  onDownload
}) => {
  if (!isLocked || !timestamp) {
    return null;
  }

  return (
    <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-1">
              Agreement Finalized & Locked
            </h3>
            <div className="flex items-center space-x-4 text-sm text-green-300">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Locked on {timestamp.toLocaleDateString()} at {timestamp.toLocaleTimeString()}</span>
              </div>
              {projectId && (
                <div className="flex items-center space-x-1">
                  <FileText className="h-4 w-4" />
                  <span>Project ID: {projectId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-green-400 font-semibold">Status: Locked</div>
            <div className="text-green-300 text-sm">Ready for execution</div>
          </div>
          {onDownload && (
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Download Agreement
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-green-800/20 rounded-lg">
        <div className="flex items-center space-x-2 text-green-300 text-sm">
          <CheckCircle className="h-4 w-4" />
          <span>
            This project agreement is now immutable and serves as the binding contract between client and freelancer.
            All deliverables will be verified against these exact specifications.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationBanner;