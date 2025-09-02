import React from 'react';

interface CalendarFilterBarProps {
  onFilterChange: (filterType: string, value: any) => void;
  onManageCategories: () => void;
}

export const CalendarFilterBar: React.FC<CalendarFilterBarProps> = ({ 
  onFilterChange, 
  onManageCategories, 
}) => {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Teams Dropdown */}
        <select 
          className="px-3 py-1.5 text-sm font-semibold border rounded-md bg-transparent text-gray-700 dark:text-gray-300"
          onChange={(e) => onFilterChange('team', e.target.value)}
        >
          <option value="">Teams</option>
          <option value="mcm">MCM</option>
          <option value="gspann">Gspann</option>
          <option value="capgemini">Capgemini</option>
        </select>

        {/* Regions Dropdown */}
        <select 
          className="px-3 py-1.5 text-sm font-semibold border rounded-md bg-transparent text-gray-700 dark:text-gray-300"
          onChange={(e) => onFilterChange('region', e.target.value)}
        >
          <option value="">Regions</option>
          <option value="global">Global</option>
          <option value="apac">APAC</option>
          <option value="north-america">North America</option>
          <option value="europe">Europe</option>
        </select>

        {/* Priorities Dropdown */}
        <select 
          className="px-3 py-1.5 text-sm font-semibold border rounded-md bg-transparent text-gray-700 dark:text-gray-300"
          onChange={(e) => onFilterChange('priority', e.target.value)}
        >
          <option value="">Priorities</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="p3">P3</option>
        </select>

        {/* Time Zone Dropdown */}
        <select 
          className="px-3 py-1.5 text-sm font-semibold border rounded-md bg-transparent text-gray-700 dark:text-gray-300"
          onChange={(e) => onFilterChange('timezone', e.target.value)}
        >
          <option value="">Time Zone</option>
          <option value="gmt">GMT</option>
          <option value="ist">IST</option>
          <option value="us">US Time</option>
          <option value="korea">Korean Time</option>
          <option value="ams">AMS Time</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={() => onManageCategories()} className="px-4 py-1.5 text-sm font-semibold border rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300">
          Manage Categories
        </button>
      </div>
    </div>
  );
};
