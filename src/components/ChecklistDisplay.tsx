import React from 'react';
import { CheckCircle, FileText, Target, Users, DollarSign, Calendar, Palette, Monitor, Zap, Settings } from 'lucide-react';

interface Parameter {
  id: string;
  label: string;
  value: string;
  category: 'content' | 'technical' | 'business' | 'timeline';
}

interface ChecklistDisplayProps {
  parameters: Parameter[];
}

const ChecklistDisplay: React.FC<ChecklistDisplayProps> = ({ parameters }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'content': return <FileText className="h-4 w-4" />;
      case 'technical': return <Settings className="h-4 w-4" />;
      case 'business': return <DollarSign className="h-4 w-4" />;
      case 'timeline': return <Calendar className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'content': return 'border-blue-500/30 bg-blue-900/10';
      case 'technical': return 'border-purple-500/30 bg-purple-900/10';
      case 'business': return 'border-green-500/30 bg-green-900/10';
      case 'timeline': return 'border-yellow-500/30 bg-yellow-900/10';
      default: return 'border-gray-500/30 bg-gray-900/10';
    }
  };

  const groupedParameters = parameters.reduce((acc, param) => {
    if (!acc[param.category]) {
      acc[param.category] = [];
    }
    acc[param.category].push(param);
    return acc;
  }, {} as Record<string, Parameter[]>);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Project Parameters Summary</h3>
        <p className="text-gray-300 text-sm">
          Review all collected project requirements before finalizing
        </p>
      </div>

      {Object.entries(groupedParameters).map(([category, params]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-lg font-semibold text-white capitalize flex items-center space-x-2">
            {getCategoryIcon(category)}
            <span>{category} Requirements</span>
          </h4>
          
          <div className="grid gap-3 md:grid-cols-2">
            {params.map((param) => (
              <div
                key={param.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${getCategoryColor(param.category)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-white text-sm">{param.label}</h5>
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 ml-2" />
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{param.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-green-400 font-semibold">All Parameters Collected!</h4>
            <p className="text-green-300 text-sm">
              {parameters.length} requirements defined and ready for agreement
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">{parameters.length}</div>
            <div className="text-xs text-green-300">Total Items</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistDisplay;