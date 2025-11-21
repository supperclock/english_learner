import React from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  role: 'user' | 'ai';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, role }) => {
  if (!isActive) {
    return <div className="h-12 w-12 rounded-full bg-gray-200/20"></div>;
  }

  return (
    <div className="flex items-center justify-center gap-1 h-12">
      <div className={`w-1.5 h-3 rounded-full animate-pulse ${role === 'ai' ? 'bg-blue-400' : 'bg-green-400'}`} style={{ animationDelay: '0ms' }}></div>
      <div className={`w-1.5 h-6 rounded-full animate-pulse ${role === 'ai' ? 'bg-blue-400' : 'bg-green-400'}`} style={{ animationDelay: '150ms' }}></div>
      <div className={`w-1.5 h-8 rounded-full animate-pulse ${role === 'ai' ? 'bg-blue-400' : 'bg-green-400'}`} style={{ animationDelay: '300ms' }}></div>
      <div className={`w-1.5 h-6 rounded-full animate-pulse ${role === 'ai' ? 'bg-blue-400' : 'bg-green-400'}`} style={{ animationDelay: '150ms' }}></div>
      <div className={`w-1.5 h-3 rounded-full animate-pulse ${role === 'ai' ? 'bg-blue-400' : 'bg-green-400'}`} style={{ animationDelay: '0ms' }}></div>
    </div>
  );
};
