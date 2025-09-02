import React, { useState, useEffect } from 'react';
import { CalendarEvent, Category } from '../../types';
import { Icon } from '../ui/Icon';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Partial<CalendarEvent> | null;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  onDelete: (eventId: string) => void;
  categories: Category[];
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, event, onSave, onDelete, categories }) => {
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    category: '',
    color: 'blue',
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        subtitle: event.subtitle || '',
        category: event.category || (categories.length > 0 ? categories[0].name : ''),
        color: event.color || 'blue',
      });
    } else {
      setFormData({
        title: '',
        subtitle: '',
        category: categories.length > 0 ? categories[0].name : '',
        color: 'blue',
      });
    }
  }, [event, categories]);

  if (!isOpen) return null;

  const isNewEvent = !event?.id;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newEventData = {
      ...formData,
      date: event?.date || new Date().toISOString(),
    };
    onSave(newEventData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{isNewEvent ? 'Add Event' : 'Edit Event'}</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <Icon name="close" className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
              <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} className="w-full px-3 py-2 rounded-md border" />
            </div>
            <div>
              <label htmlFor="subtitle" className="block text-sm font-medium mb-1">Subtitle</label>
              <input type="text" name="subtitle" id="subtitle" value={formData.subtitle} onChange={handleChange} className="w-full px-3 py-2 rounded-md border" />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-1">Category</label>
              <select name="category" id="category" value={formData.category} onChange={handleChange} className="w-full px-3 py-2 rounded-md border">
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="color" className="block text-sm font-medium mb-1">Color</label>
              <select name="color" id="color" value={formData.color} onChange={handleChange} className="w-full px-3 py-2 rounded-md border">
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="blue">Blue</option>
                <option value="yellow">Yellow</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            {!isNewEvent && (
              <button type="button" onClick={() => onDelete(event!.id!)} className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700">
                Delete
              </button>
            )}
            <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700">
              {isNewEvent ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
