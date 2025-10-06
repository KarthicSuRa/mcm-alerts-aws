import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Session } from '../../types';

interface ProfileSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: Session;
    onProfileUpdate: (newName: string) => void;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onClose, session, onProfileUpdate }) => {
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName.trim() })
                .eq('id', session.user.id);

            if (error) throw error;

            onProfileUpdate(fullName.trim());
            onClose();
        } catch (err: any) {
            console.error("Error updating profile:", err);
            setError('Failed to update your profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]">
            <div className="bg-card text-card-foreground p-8 rounded-lg shadow-xl max-w-sm w-full mx-4">
                <h2 className="text-2xl font-bold mb-4">Welcome!</h2>
                <p className="text-muted-foreground mb-6">Let\'s get your profile set up. Please enter your full name.</p>

                <div className="mb-4">
                    <label htmlFor="fullName" className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
                    <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g., Jane Doe"
                        className="w-full px-4 py-2 text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-input"
                    />
                </div>
                
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <div className="flex justify-end gap-4">
                    <button
                        onClick={handleUpdateProfile}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save and Continue'}
                    </button>
                </div>
                 <p className="text-xs text-muted-foreground mt-4">You can change this later in your settings.</p>
            </div>
        </div>
    );
};
