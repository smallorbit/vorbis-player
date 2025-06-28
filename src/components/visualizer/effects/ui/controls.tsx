// Simple UI components for visualizer controls

import React from 'react';

export const Button = ({ 
  children, 
  onClick, 
  variant = 'default',
  className = '',
  'aria-selected': ariaSelected,
  ...props 
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'ghost';
  className?: string;
  'aria-selected'?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded ${
      variant === 'ghost' 
        ? 'bg-transparent hover:bg-gray-100' 
        : 'bg-blue-500 hover:bg-blue-600 text-white'
    } ${ariaSelected ? 'bg-blue-200' : ''} ${className}`}
    aria-selected={ariaSelected}
    {...props}
  >
    {children}
  </button>
);

export const Label = ({ children, ...props }: { children: React.ReactNode }) => (
  <label className="text-sm font-medium text-gray-700" {...props}>
    {children}
  </label>
);

export const Slider = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  ...props
}: {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number[]) => void;
}) => (
  <input
    type="range"
    min={min}
    max={max}
    step={step}
    value={value[0]}
    onChange={(e) => onValueChange([Number(e.target.value)])}
    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    {...props}
  />
);

export const ValueLabel = ({ 
  label, 
  value 
}: { 
  label: string; 
  value: string | number;
}) => (
  <div className="flex justify-between items-center w-full">
    <Label>{label}</Label>
    <span className="text-sm text-gray-500">{value}</span>
  </div>
);

export const Switch = ({
  defaultChecked,
  onCheckedChange,
  ...props
}: {
  defaultChecked?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <input
    type="checkbox"
    defaultChecked={defaultChecked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className="w-6 h-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
    {...props}
  />
);