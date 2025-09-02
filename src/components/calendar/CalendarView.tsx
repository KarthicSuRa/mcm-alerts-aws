import React, { useState } from 'react';
import { CalendarFilterBar } from './CalendarFilterBar';
import { CalendarGrid } from './CalendarGrid';
import { EventModal } from './EventModal';
import { CategoryManager } from './CategoryManager';
import { sampleEvents, sampleCategories } from '../../data/calendar-data';
import { CalendarEvent, Category } from '../../types';

export const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 11, 1)); // December 2024
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);
  const [categories, setCategories] = useState<Category[]>(sampleCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({
    teams: [],
    regions: [],
    systems: [],
    priorities: []
  });

  const handleFilterChange = (filterType: string, value: any) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const handleDayClick = (date: Date) => {
    setSelectedEvent({ date: date.toISOString() });
    setIsModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleSaveEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    if (selectedEvent?.id) {
      // Update existing event
      setEvents(events.map(e => e.id === selectedEvent.id ? { ...e, ...eventData, id: selectedEvent.id } : e));
    } else {
      // Create new event
      const newEvent = { ...eventData, id: (Math.random() * 1000).toString(), date: selectedEvent?.date || new Date().toISOString() }; // Temporary ID
      setEvents([...events, newEvent]);
    }
    handleCloseModal();
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter(e => e.id !== eventId));
    handleCloseModal();
  };

  const handleSaveCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
  };

  const filteredEvents = events.filter(event => {
    // Implement filter logic here based on filters state
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-6">
      <CalendarFilterBar 
        onFilterChange={handleFilterChange} 
        onManageCategories={() => setIsCategoryManagerOpen(true)}
      />
      <CalendarGrid 
        currentDate={currentDate} 
        events={filteredEvents} 
        onDateChange={setCurrentDate}
        onDayClick={handleDayClick}
        onEventClick={handleEventClick}
      />
      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        categories={categories}
      />
      {isCategoryManagerOpen && (
        <CategoryManager
          categories={categories}
          onSave={handleSaveCategories}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      )}
    </div>
  );
};
