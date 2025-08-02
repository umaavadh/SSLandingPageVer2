import React, { useState } from 'react';
import { User, Calendar, CheckCircle } from 'lucide-react';

interface Signature {
  name: string;
  date: string;
  timestamp: Date | null;
}

interface SignatureBoxProps {
  title: string;
  placeholder: string;
  signature: Signature;
  onSignatureChange: (signature: Signature) => void;
  disabled?: boolean;
}

const SignatureBox: React.FC<SignatureBoxProps> = ({
  title,
  placeholder,
  signature,
  onSignatureChange,
  disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSign = () => {
    if (signature.name.trim()) {
      const now = new Date();
      onSignatureChange({
        ...signature,
        date: now.toLocaleDateString(),
        timestamp: now
      });
      setIsEditing(false);
    }
  };

  const isSigned = signature.timestamp !== null;

  return (
    <div className={`p-4 rounded-lg border transition-all duration-200 ${
      isSigned 
        ? 'border-green-500/30 bg-green-900/10' 
        : 'border-gray-600 bg-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>{title}</span>
        </h4>
        {isSigned && (
          <div className="flex items-center space-x-1 text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Signed</span>
          </div>
        )}
      </div>

      {!isSigned ? (
        <div className="space-y-3">
          <input
            type="text"
            value={signature.name}
            onChange={(e) => onSignatureChange({ ...signature, name: e.target.value })}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSign}
            disabled={!signature.name.trim() || disabled}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            Sign Agreement
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-green-400">
            <span className="font-medium">{signature.name}</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400 text-sm">
            <Calendar className="h-3 w-3" />
            <span>Signed on {signature.date}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignatureBox;