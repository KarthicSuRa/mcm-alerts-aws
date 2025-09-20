import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, SystemStatusData, Notification, Database, Topic } from '../types';
import { Header } from '../components/layout/Header';

type Profile = Database['public']['Tables']['profiles']['Row'];
type TeamMember = Database['public']['Tables']['team_members']['Row'] & { profiles: Profile };
type Team = Database['public']['Tables']['teams']['Row'] & { team_members: TeamMember[] };

interface UserManagementPageProps {
    session: Session | null;
    topics: Topic[];
    onLogout: () => Promise<void>;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    notifications: Notification[];
    openSettings: () => void;
    systemStatus: SystemStatusData;
    onNavigate: (page: string) => void;
    onUpdateTopicTeam: (topicId: string, teamId: string | null) => Promise<void>;
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({
    session,
    topics,
    onLogout,
    isSidebarOpen,
    setIsSidebarOpen,
    notifications,
    openSettings,
    systemStatus,
    onNavigate,
    onUpdateTopicTeam,
}) => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTeamName, setNewTeamName] = useState('');
    const [managingTeam, setManagingTeam] = useState<Team | null>(null);
    const [userToAdd, setUserToAdd] = useState('');
    const [editingUser, setEditingUser] = useState<Profile | null>(null);
    const [editedFields, setEditedFields] = useState<{ full_name: string | null; app_role: string }>({ full_name: '', app_role: 'member' });
    const [activeTab, setActiveTab] = useState('users');

    useEffect(() => {
        if (session) {
            fetchData();
        }
    }, [session]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([getUsers(), getTeams()]);
        setLoading(false);
    };

    const getUsers = async () => {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) console.error('Error fetching users:', error);
        else setUsers(data || []);
    };

    const getTeams = async () => {
        const { data, error } = await supabase.from('teams').select('*, team_members(*, profiles(*))');
        if (error) console.error('Error fetching teams:', error);
        else setTeams(data as Team[] || []);
    };

    const createTeam = async () => {
        if (!newTeamName.trim() || !session?.user) return;
        const { data, error } = await supabase
            .from('teams')
            .insert([{ name: newTeamName, created_by: session.user.id }])
            .select('*, team_members(*, profiles(*))') // Reselect the team with its (empty) members
            .single();
    
        if (error) {
            alert(`Error creating team: ${error.message}`);
        } else if (data) {
            // Instantly update the UI with the new team
            setTeams(prevTeams => [...prevTeams, data as Team]);
            setNewTeamName('');
        } else {
            // Fallback if data isn't returned (e.g., RLS issues)
            alert('Team created, but failed to update UI instantly. Refreshing data...');
            await getTeams();
        }
    };
    
    const handleUpdateUser = async () => {
        if (!editingUser) return;
        const { data, error } = await supabase
            .from('profiles')
            .update({ full_name: editedFields.full_name, app_role: editedFields.app_role })
            .eq('id', editingUser.id)
            .select()
            .single();

        if (error) {
            alert(`Error updating user: ${error.message}`);
        } else if (data) {
            setUsers(users.map(u => (u.id === data.id ? data : u)));
            setEditingUser(null);
        }
    };

    const addMemberToTeam = async () => {
        if (!userToAdd || !managingTeam) return;
        const { data, error } = await supabase
            .from('team_members')
            .insert([{ team_id: managingTeam.id, user_id: userToAdd, team_role: 'member' }])
            .select('*, profiles(*)') // Reselect the member with their profile
            .single();
    
        if (error) {
            alert(`Error adding member: ${error.message}`);
        } else if (data) {
            // Instantly update the UI
            setTeams(prevTeams => prevTeams.map(team =>
                team.id === managingTeam.id
                    ? { ...team, team_members: [...team.team_members, data as TeamMember] }
                    : team
            ));
            setUserToAdd('');
        } else {
             // Fallback if data isn't returned
            alert('Member added, but failed to update UI instantly. Refreshing data...');
            await getTeams();
        }
    };
    
    // This useEffect ensures that the 'managingTeam' state is always fresh
    // when the underlying 'teams' data changes.
    useEffect(() => {
        if (managingTeam?.id) {
            const freshTeamData = teams.find(t => t.id === managingTeam.id);
            setManagingTeam(freshTeamData || null);
        }
    }, [teams, managingTeam?.id]);

    const removeMemberFromTeam = async (userId: string) => {
        if (!managingTeam) return;
        const { error } = await supabase
            .from('team_members')
            .delete()
            .match({ team_id: managingTeam.id, user_id: userId });

        if (error) {
            alert(`Error removing member: ${error.message}`);
        } else {
            // Instantly update the UI by filtering out the removed member
            setTeams(prevTeams => prevTeams.map(team =>
                team.id === managingTeam.id
                    ? { ...team, team_members: team.team_members.filter(m => m.user_id !== userId) }
                    : team
            ));
        }
    };
    
    const usersNotInTeam = useMemo(() => {
        if (!managingTeam) return users;
        const memberIds = new Set(managingTeam.team_members.map(m => m.profiles.id));
        return users.filter(u => !memberIds.has(u.id));
    }, [users, managingTeam]);

    const topicsForTeam = useMemo(() => {
        if (!managingTeam) return [];
        return topics.map(topic => ({
            ...topic,
            isAssigned: topic.team_id === managingTeam.id,
        }));
    }, [topics, managingTeam]);

    return (
        <div className="flex flex-col h-screen bg-background md:ml-72">
            <Header
                onNavigate={onNavigate}
                onLogout={onLogout}
                notifications={notifications}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                openSettings={openSettings}
                systemStatus={systemStatus}
                session={session}
                title="User & Team Management"
            />
            <main className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center">Loading...</div>
                ) : (
                    <div className="p-4 md:p-8">
                        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                <button
                                    onClick={() => setActiveTab('users')}
                                    className={`${
                                        activeTab === 'users'
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Users
                                </button>
                                <button
                                    onClick={() => setActiveTab('teams')}
                                    className={`${
                                        activeTab === 'teams'
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Teams
                                </button>
                            </nav>
                        </div>

                        {activeTab === 'users' && (
                            <div>
                                <h2 className="text-xl font-semibold mb-3 text-foreground">All Users</h2>
                                <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-border dark:divide-gray-700">
                                            <thead className="bg-muted/50 dark:bg-gray-700">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">App Role</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-card dark:bg-gray-800 divide-y divide-border dark:divide-gray-700">
                                                {users.map(user => (
                                                    <tr key={user.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-card-foreground dark:text-white">{user.full_name || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-gray-400">{user.email}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-gray-400">{user.app_role}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingUser(user);
                                                                    setEditedFields({ full_name: user.full_name, app_role: user.app_role });
                                                                }}
                                                                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                                                            >
                                                                Edit
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'teams' && (
                             <div>
                                <h2 className="text-xl font-semibold mb-3 text-foreground">All Teams</h2>
                                <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                            placeholder="New team name..."
                                            className="flex-grow px-3 py-2 border rounded-md text-sm bg-input text-foreground border-border"
                                        />
                                        <button
                                            onClick={createTeam}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold"
                                        >
                                            Create Team
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-border dark:divide-gray-700">
                                            <thead className="bg-muted/50 dark:bg-gray-700">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Members</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-card dark:bg-gray-800 divide-y divide-border dark:divide-gray-700">
                                                {teams.map(team => (
                                                    <tr key={team.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-card-foreground dark:text-white">{team.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-gray-400">{team.team_members.length}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button onClick={() => setManagingTeam(team)} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                                                                Manage
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {editingUser && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="relative bg-card rounded-lg shadow-xl w-full max-w-lg">
                        <div className="flex items-start justify-between p-4 border-b rounded-t">
                            <h3 className="text-xl font-semibold text-foreground">Edit User: {editingUser.email}</h3>
                            <button type="button" className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" onClick={() => setEditingUser(null)}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label htmlFor="fullName" className="block mb-2 text-sm font-medium text-foreground">Full Name</label>
                                <input
                                    type="text"
                                    id="fullName"
                                    value={editedFields.full_name || ''}
                                    onChange={(e) => setEditedFields({ ...editedFields, full_name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md text-sm bg-input text-foreground border-border"
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label htmlFor="appRole" className="block mb-2 text-sm font-medium text-foreground">App Role</label>
                                <select
                                    id="appRole"
                                    value={editedFields.app_role}
                                    onChange={(e) => setEditedFields({ ...editedFields, app_role: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md text-sm bg-input text-foreground border-border"
                                >
                                    <option value="member">member</option>
                                    <option value="super_admin">super_admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center p-6 space-x-2 border-t border-border rounded-b">
                            <button onClick={handleUpdateUser} type="button" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Save Changes</button>
                            <button onClick={() => setEditingUser(null)} type="button" className="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {managingTeam && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="relative bg-card rounded-lg shadow-xl w-full max-w-4xl">
                        <div className="flex items-start justify-between p-4 border-b border-border rounded-t">
                            <h3 className="text-xl font-semibold text-foreground">Manage Team: {managingTeam.name}</h3>
                            <button type="button" className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" onClick={() => setManagingTeam(null)}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-semibold text-foreground mb-2">Add Member</h4>
                                    <div className="flex gap-2">
                                        <select value={userToAdd} onChange={(e) => setUserToAdd(e.target.value)} className="flex-grow px-3 py-2 border rounded-md text-sm bg-input text-foreground border-border">
                                            <option value="">Select a user...</option>
                                            {usersNotInTeam.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
                                        </select>
                                        <button onClick={addMemberToTeam} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold">Add</button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-foreground mb-2">Current Members ({managingTeam.team_members.length})</h4>
                                    <ul className="divide-y divide-border border rounded-md max-h-60 overflow-y-auto">
                                        {managingTeam.team_members.map(member => (
                                            <li key={member.user_id} className="px-4 py-3 flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm font-medium text-card-foreground">{member.profiles.full_name}</p>
                                                    <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                                                </div>
                                                <button onClick={() => removeMemberFromTeam(member.user_id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Remove</button>
                                            </li>
                                        ))}
                                        {managingTeam.team_members.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground text-center">No members in this team yet.</li>}
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-foreground mb-2">Topic Assignments</h4>
                                <div className="divide-y divide-border border rounded-md max-h-[22rem] overflow-y-auto">
                                    {topicsForTeam.map(topic => (
                                        <div key={topic.id} className="px-4 py-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-medium text-card-foreground">{topic.name}</p>
                                                <p className="text-sm text-muted-foreground">{topic.description || 'No description'}</p>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={topic.isAssigned}
                                                onChange={() => onUpdateTopicTeam(topic.id, topic.isAssigned ? null : managingTeam.id)}
                                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </div>
                                    ))}
                                    {topicsForTeam.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground text-center">No topics available to assign.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPage;
