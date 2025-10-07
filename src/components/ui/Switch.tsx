import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled = false }) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const baseClasses = 'relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500';
  const stateClasses = checked ? 'bg-blue-600' : 'bg-gray-300';
  const cursorClass = disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      className={`${baseClasses} ${stateClasses} ${cursorClass}`}>
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
};
