import React, { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { CalendarFilterBar } from './CalendarFilterBar';
import { CalendarGrid } from './CalendarGrid';
import { EventModal } from './EventModal';
import { CategoryManager } from './CategoryManager';
import { CalendarEvent, Category } from '../../types';
import { awsClient } from '../../lib/awsClient';

export interface CalendarViewHandle {
  resetToToday: () => void;
}

export const CalendarView = forwardRef<CalendarViewHandle, {}>((props, ref) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({
    teams: [],
    regions: [],
    systems: [],
    priorities: []
  });

  const fetchEvents = useCallback(async () => {
    try {
      const eventData = await awsClient.get('/events');
      setEvents(eventData || []);
    } catch (err: any) {
      setError('Failed to fetch events. Please try again later.');
      console.error(err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const categoryData = await awsClient.get('/categories');
      setCategories(categoryData || []);
    } catch (err: any) {
      setError('Failed to fetch categories.');
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchEvents(), fetchCategories()]);
      setLoading(false);
    };
    fetchData();
  }, [fetchEvents, fetchCategories]);


  useImperativeHandle(ref, () => ({
    resetToToday() {
      setCurrentDate(new Date());
    }
  }));

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

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
    try {
      if (selectedEvent?.id) {
        // Update existing event
        await awsClient.put(`/events/${selectedEvent.id}`, eventData);
      } else {
        // Create new event
        await awsClient.post('/events', eventData);
      }
      fetchEvents(); // Refetch events after saving
      handleCloseModal();
    } catch (err) {
      console.error("Failed to save event:", err);
      setError("Failed to save event.");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await awsClient.delete(`/events/${eventId}`);
      fetchEvents(); // Refetch events after deleting
      handleCloseModal();
    } catch (err) {
        console.error("Failed to delete event:", err);
        setError("Failed to delete event.");
    }
  };

  const handleSaveCategories = async (newCategories: Category[]) => {
    try {
      await awsClient.post('/categories', newCategories);
      fetchCategories();
      setIsCategoryManagerOpen(false);
    } catch (err) {
        console.error("Failed to save categories:", err);
        setError("Failed to save categories.");
    }
  };

  const filteredEvents = events.filter(event => {
    // Implement filter logic here based on filters state
    return true;
  });
  
  if (loading) {
    return <div className="text-center p-8">Loading Calendar...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

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
});
