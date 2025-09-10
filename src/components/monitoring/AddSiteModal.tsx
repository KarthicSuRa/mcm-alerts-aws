import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { countries } from '../../lib/countries';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteAdded: () => void;
}

export const AddSiteModal: React.FC<AddSiteModalProps> = ({ isOpen, onClose, onSiteAdded }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !url || !country) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      new URL(url);
    } catch (_) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    
    setLoading(true);

    try {
      const selectedCountry = countries.find(c => c.code === country);
      if (!selectedCountry) {
        throw new Error('Invalid country selected');
      }

      const { error: insertError } = await supabase
        .from('monitored_sites')
        .insert([{
          name,
          url,
          country: selectedCountry.code,
          latitude: selectedCountry.latitude,
          longitude: selectedCountry.longitude,
        }]);

      if (insertError) {
        throw insertError;
      }
      
      onSiteAdded();
      onClose();
      setName('');
      setUrl('');
      setCountry('');
    } catch (e: any) {
      console.error("Error adding site:", e);
      setError(`Failed to add site: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New Site</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="site-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label>
            <input
              type="text"
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
              placeholder="My Awesome Blog"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="site-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
            <input
              type="url"
              id="site-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
              placeholder="https://example.com"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            >
              <option value="" disabled>Select a country</option>
              {countries.map(country => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex justify-end space-x-4">
            <Button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Site'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
