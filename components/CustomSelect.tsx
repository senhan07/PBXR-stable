
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, placeholder = "Select...", className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    
    // Close on scroll or resize to prevent detached dropdowns
    const handleScrollOrResize = () => setIsOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  useEffect(() => {
      if (isOpen && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCoords({
              top: rect.bottom + window.scrollY + 6,
              left: rect.left + window.scrollX,
              width: rect.width
          });
      }
  }, [isOpen]);

  const dropdown = (
    <div 
        ref={dropdownRef}
        data-custom-select-portal
        className="absolute z-[9999] bg-[#18181b] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto animate-slide-up"
        style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`, 
            width: `${coords.width}px` 
        }}
    >
        <div className="p-1">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2.5 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${
                  value === option.value ? 'bg-blue-600/10 text-blue-400' : 'text-gray-300 hover:bg-[#27272a] hover:text-white'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{option.label}</span>
                  {option.description && (
                      <span className="text-[10px] text-gray-500 group-hover:text-gray-400 mt-0.5">{option.description}</span>
                  )}
                </div>
                {value === option.value && <Check className="w-4 h-4 text-blue-500" />}
              </div>
            ))}
            {options.length === 0 && (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">No options available</div>
            )}
        </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-left text-sm text-gray-200 flex items-center justify-between hover:border-blue-500/50 hover:bg-[#202024] focus:border-blue-500 transition-all shadow-sm"
      >
        <span className={!selectedOption ? "text-gray-500" : ""}>
            {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(dropdown, document.body)}
    </div>
  );
};
