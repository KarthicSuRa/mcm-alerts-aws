import React, { useRef } from 'react';
import { Header } from '../components/layout/Header';
import { CalendarView, CalendarViewHandle } from '../components/calendar/CalendarView';
import { Icon } from '../components/ui/Icon';
import { Notification, SystemStatusData, Session } from '../types';

interface CalendarPageProps {
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  notifications: Notification[];
  session: Session;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ onNavigate, isSidebarOpen, setIsSidebarOpen, onLogout, openSettings, systemStatus, notifications, session }) => {
  const calendarRef = useRef<CalendarViewHandle>(null);

  const handleTodayClick = () => {
    calendarRef.current?.resetToToday();
  };

  const handleSearchClick = () => {
    alert('Search functionality is not yet implemented.');
  };

  const handleViewChangeClick = () => {
    alert('View change functionality is not yet implemented.');
  };

  return (
    <>
      <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
      <main className="flex-1 overflow-y-auto bg-background md:ml-72">
        <div className="p-4 md:p-6 lg:p-8 text-foreground">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mr-4">
                  <Icon name="arrow-left" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </button>
              <h1 className="text-3xl font-bold">Calendar</h1>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <button onClick={handleSearchClick} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <Icon name="search" className="h-5 w-5" />
              </button>
              <button onClick={handleViewChangeClick} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <Icon name="grid" className="h-5 w-5" />
              </button>
              <button onClick={handleTodayClick} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <Icon name="calendar-view" className="h-5 w-5" />
              </button>
            </div>
          </div>

          <CalendarView ref={calendarRef} />
        </div>
      </main>
    </>
  );
};
