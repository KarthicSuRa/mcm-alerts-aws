import React from 'react';
import { CalendarView } from '../components/calendar/CalendarView';
import { Icon } from '../components/ui/Icon';

interface CalendarPageProps {
  onNavigate: (page: string) => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ onNavigate }) => {
  return (
    <div className="p-4 md:p-6 lg:p-8 text-foreground bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mr-4 lg:hidden">
              <Icon name="arrow-left" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-3xl font-bold">Calendar</h1>
        </div>
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <Icon name="search" className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <Icon name="grid" className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <Icon name="calendar-view" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <CalendarView />
    </div>
  );
};
