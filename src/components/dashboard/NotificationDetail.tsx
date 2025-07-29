

import React, { useState } from 'react';
import { Notification, NotificationStatus, Session, Comment, NotificationUpdatePayload } from '../../types';
import { Icon } from '../ui/Icon';

interface NotificationDetailProps {
    notification: Notification;
    onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => void;
    onAddComment: (notificationId: string, text: string) => void;
    session: Session;
}

export const NotificationDetail: React.FC<NotificationDetailProps> = ({ notification, onUpdateNotification, onAddComment, session }) => {
    const [commentText, setCommentText] = useState('');

    const handleStatusUpdate = (status: NotificationStatus, actionText?: string) => {
        onAddComment(notification.id, actionText || `Status changed to ${status}.`);
        onUpdateNotification(notification.id, { status });
    };

    const handleAddComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        onAddComment(notification.id, commentText);
        setCommentText('');
    };

    return (
        <div className="bg-secondary/30 p-4 border-t border-border">
            <div className="mb-4">
                <p className="text-base text-muted-foreground mb-4 whitespace-pre-wrap">{notification.message}</p>
                <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    <p><strong>ID:</strong> {notification.id}</p>
                    <p><strong>Timestamp:</strong> {new Date(notification.timestamp).toLocaleString()}</p>
                    {notification.site && <p><strong>Site:</strong> {notification.site}</p>}
                </div>
            </div>

            {/* Activity Feed */}
            <div className="mt-6">
                <h3 className="text-base font-semibold mb-4">Activity</h3>
                <div className="space-y-4 max-h-56 overflow-y-auto pr-2">
                    {[...(notification.comments || [])].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((comment: Comment) => {
                        const isCurrentUser = comment.user_id === session.user.id;
                        const userInitial = (comment.user_email || 'A')[0].toUpperCase();
                        return (
                            <div key={comment.id} className="flex gap-3">
                                <div className={`w-8 h-8 rounded-full ${isCurrentUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                                    {userInitial}
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <p className="font-semibold text-sm">{isCurrentUser ? 'You' : (comment.user_email || 'Admin')}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleTimeString()}</p>
                                    </div>
                                    <p className="text-sm text-foreground bg-secondary rounded-lg p-2 mt-1">{comment.text}</p>
                                </div>
                            </div>
                        )
                    })}
                     {(notification.comments || []).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
                     )}
                </div>
            </div>

            {/* Actions */}
            <footer className="mt-4 pt-4 border-t border-border space-y-3">
                 <form onSubmit={handleAddComment} className="flex gap-2">
                    <input 
                        type="text" 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 w-full px-3 py-2 text-sm bg-background border-border rounded-md focus:ring-ring focus:border-ring"
                    />
                    <button type="submit" className="px-3 py-2 rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 flex items-center justify-center" disabled={!commentText.trim()}>
                        <Icon name="send" className="w-5 h-5" />
                    </button>
                </form>
                <div className="flex gap-2 justify-end">
                    {notification.status === 'new' && (
                         <button onClick={() => handleStatusUpdate('acknowledged')} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-success/20 text-success-foreground hover:bg-success/30">Acknowledge</button>
                    )}
                     {notification.status === 'resolved' && (
                         <button onClick={() => handleStatusUpdate('new', 'Status changed to Re-opened.')} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-500/10 text-purple-600 hover:bg-purple-500/20">Re-open</button>
                    )}
                    {notification.status !== 'resolved' && (
                        <button onClick={() => handleStatusUpdate('resolved')} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/20 text-primary hover:bg-primary/30">Resolve</button>
                    )}
                </div>
            </footer>
        </div>
    );
};
