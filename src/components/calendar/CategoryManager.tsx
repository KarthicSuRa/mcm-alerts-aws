import React, { useState } from 'react';
import { Icon } from '../ui/Icon';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryManagerProps {
  categories: Category[];
  onSave: (categories: Category[]) => void;
  onClose: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories: initialCategories, onSave, onClose }) => {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#FFFFFF');

  const addCategory = () => {
    if (newCategoryName.trim() === '') return;
    const newCategory = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
    };
    setCategories([...categories, newCategory]);
    setNewCategoryName('');
  };

  const updateCategory = (id: string, newName: string) => {
    setCategories(categories.map(cat => cat.id === id ? { ...cat, name: newName } : cat));
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(cat => cat.id !== id));
  };

  const handleSave = () => {
    onSave(categories);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Manage Categories</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <Icon name="close" className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-3 mb-6" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {categories.map(category => (
            <div key={category.id} className="flex items-center gap-3 p-2 rounded-md bg-gray-50 dark:bg-slate-700/50">
              <span className="w-5 h-5 rounded-full" style={{ backgroundColor: category.color }}></span>
              <input 
                type="text" 
                value={category.name} 
                onChange={(e) => updateCategory(category.id, e.target.value)}
                className="flex-grow bg-transparent focus:outline-none"
              />
              <button onClick={() => deleteCategory(category.id)} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">
                <Icon name="close" className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Add New Category */}
        <div className="flex items-center gap-3 mb-6">
          <input 
            type="color" 
            value={newCategoryColor}
            onChange={(e) => setNewCategoryColor(e.target.value)}
            className="w-10 h-10 p-1 bg-transparent border-none cursor-pointer"
          />
          <input 
            type="text" 
            value={newCategoryName} 
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Add new category..."
            className="flex-grow px-3 py-2 rounded-md border"
          />
          <button onClick={addCategory} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700">
            Add
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} className="px-6 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700">
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
