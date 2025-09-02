import { CalendarEvent, Category } from '../types';

export const sampleEvents: CalendarEvent[] = [
  {
    id: '1',
    date: '2024-12-02',
    title: 'Team Standup',
    subtitle: 'Engineering',
    category: 'Campaigns',
    color: 'green',
  },
  {
    id: '2',
    date: '2024-12-05',
    title: 'Product Review',
    subtitle: 'All Hands',
    category: 'Releases',
    color: 'blue',
  },
  {
    id: '3',
    date: '2024-12-05',
    title: 'Design Sync',
    subtitle: 'Creative Team',
    category: 'Maintenance',
    color: 'red',
  },
  {
    id: '4',
    date: '2024-12-11',
    title: 'Q4 Planning',
    subtitle: 'Leadership',
    category: 'Campaigns',
    color: 'yellow',
  },
  {
    id: '5',
    date: '2024-12-18',
    title: 'Winter Holiday Party',
    subtitle: 'Company-wide',
    category: 'Releases',
    color: 'blue',
  },
  {
    id: '6',
    date: '2024-12-25',
    title: 'Christmas Day',
    subtitle: 'Public Holiday',
    category: 'Maintenance',
    color: 'red',
  },
];

export const sampleCategories: Category[] = [
  { id: '1', name: 'Campaigns', color: '#4A90E2' },
  { id: '2', name: 'Releases', color: '#50E3C2' },
  { id: '3', name: 'Maintenance', color: '#F5A623' },
];
