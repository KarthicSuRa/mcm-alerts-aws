
import React from 'react';
import { CalendarEvent } from '../../types';
import { Icon } from '../ui/Icon';
import { eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isSameMonth, isToday, add, sub } from 'date-fns';

interface CalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const EventCard: React.FC<{ event: CalendarEvent, onClick: (event: CalendarEvent) => void }> = ({ event, onClick }) => {
  const bgColor = {
    green: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-200',
    red: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-200',
    blue: 'bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900/50 dark:border-cyan-700 dark:text-cyan-200',
    yellow: 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/50 dark:border-amber-700 dark:text-amber-200',
  }[event.color || 'blue'];

  const handleEventClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the day click from firing
    onClick(event);
  };

  return (
    <div onClick={handleEventClick} className={`p-1.5 rounded-md border text-xs font-semibold mb-1 cursor-pointer hover:opacity-80 transition-opacity ${bgColor}`}>
      <p>{event.title}</p>
      {event.subtitle && <p className="font-normal opacity-80">{event.subtitle}</p>}
    </div>
  )
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, events, onDateChange, onDayClick, onEventClick }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handlePrevMonth = () => onDateChange(sub(currentDate, { months: 1 }));
  const handleNextMonth = () => onDateChange(add(currentDate, { months: 1 }));
  const handleToday = () => onDateChange(new Date());

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-semibold border rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300">Month</button>
        </div>
        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><Icon name="chevron-left" /></button>
          <h2 className="text-xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><Icon name="chevron-right" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleToday} className="px-4 py-1.5 text-sm font-semibold border rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300">Today</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 border-t border-l border-gray-200 dark:border-slate-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-sm font-semibold text-gray-500 border-r border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            {day}
          </div>
        ))}

        {days.map(day => {
          const dayEvents = events.filter(e => format(new Date(e.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
          return (
            <div key={day.toString()} onClick={() => onDayClick(day)} className={`relative h-36 p-2 border-r border-b border-gray-200 dark:border-slate-700 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
              !isSameMonth(day, monthStart) ? 'bg-gray-50/50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'
            }`}>
              <time dateTime={format(day, 'yyyy-MM-dd')} className={`text-sm font-semibold ${
                isToday(day) ? 'bg-blue-600 text-white rounded-full flex items-center justify-center h-7 w-7' : isSameMonth(day, monthStart) ? 'text-gray-800 dark:text-slate-200' : 'text-gray-400 dark:text-slate-500'
              }`}>
                {format(day, 'd')}
              </time>
              <div className="mt-1">
                {dayEvents.map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    onClick={onEventClick} 
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};
