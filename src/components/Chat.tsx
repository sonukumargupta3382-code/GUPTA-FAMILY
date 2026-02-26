import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Image as ImageIcon, Loader2, Trash2, Paperclip, X, PlayCircle, LogOut, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { GroupInfo } from './GroupInfo';

interface Message {
  id: string;
  text: string;
  uid: string;
  display_name: string;
  photo_url: string;
  media_url?: string;
  media_type?: 'image' | 'video' | null;
  media_size?: string; // e.g. "2.5 MB"
  created_at: string;
}

export function Chat({ user }: { user: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupName, setGroupName] = useState("GUPTA FAMILY");
  const [groupImage, setGroupImage] = useState("https://ui-avatars.com/api/?name=Gupta+Family&background=0D8ABC&color=fff");
  const [missingTables, setMissingTables] = useState(false);
  
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Multi-select state
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedMsgIds.size > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const touchTimer = useRef<any>(null);

  const handleTouchStart = (msgId: string) => {
    touchTimer.current = setTimeout(() => {
        handleLongPress(msgId);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
    }
  };

  // Long press handler
  const handleLongPress = (msgId: string) => {
    // Prevent default browser context menu if possible
    if (navigator.vibrate) navigator.vibrate(50);
    
    if (!isSelectionMode) {
        // Start selection mode
        const newSet = new Set(selectedMsgIds);
        newSet.add(msgId);
        setSelectedMsgIds(newSet);
    } else {
        // If already in selection mode, just toggle
        handleMessageClick(msgId);
    }
  };

  const handleMessageClick = (msgId: string) => {
    if (isSelectionMode) {
        const newSet = new Set(selectedMsgIds);
        if (newSet.has(msgId)) {
            newSet.delete(msgId);
        } else {
            newSet.add(msgId);
        }
        setSelectedMsgIds(newSet);
    }
  };

  const handleCancelSelection = () => {
    setSelectedMsgIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedMsgIds.size === 0) return;
    
    // Filter to only allow deleting own messages
    const ownMessagesToDelete = messages.filter(m => selectedMsgIds.has(m.id) && m.uid === user.id);
    
    if (ownMessagesToDelete.length === 0) {
        alert("You can only delete your own messages.");
        setSelectedMsgIds(new Set());
        return;
    }

    if (window.confirm(`Delete ${ownMessagesToDelete.length} selected message(s)?`)) {
        try {
            const idsToDelete = ownMessagesToDelete.map(m => m.id);
            
            // Use select() to get back the deleted rows to verify deletion
            const { error, data } = await supabase
                .from('messages')
                .delete()
                .in('id', idsToDelete)
                .select();
            
            if (error) throw error;

            // Check if anything was actually deleted
            if (!data || data.length === 0) {
                throw new Error("Permission denied. Database policy prevented deletion.");
            }
            
            // Optimistic update
            setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
            setSelectedMsgIds(new Set()); // Exit selection mode
            
        } catch (error: any) {
            console.error("Error deleting messages:", error);
            alert(`Delete Failed: ${error.message}\n\nPossible Reason: You haven't run the SQL code to enable 'User Delete' policy.`);
        }
    }
  };
  
  // Defensive check
  if (!user) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-900">
            <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Loading chat...</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 text-xs text-indigo-400 underline hover:text-indigo-300"
                >
                  Reload if stuck
                </button>
            </div>
        </div>
      );
  }

  useEffect(() => {
    // Request Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    
    // Initial Fetch
    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error fetching messages:', error);
                // If table doesn't exist, show setup screen
                if (error.code === '42P01') {
                    setMissingTables(true);
                }
            } else {
                setMessages(data || []);
                setMissingTables(false);
            }
        } catch (err) {
            console.error("Unexpected error fetching messages:", err);
        }
        
        setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    fetchMessages();

    // Realtime Subscription
    const channel = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => [...prev, newMsg]);
            
            // Notification
            if (newMsg.uid !== user.id) {
                 if ("Notification" in window && Notification.permission === "granted") {
                    new Notification(`New message from ${newMsg.display_name || 'Someone'}`, {
                        body: newMsg.text || 'Sent a photo/video',
                        icon: '/vite.svg'
                    });
                    
                    // Play sound
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
                    audio.play().catch(e => console.log("Audio play failed", e));
                }
            }

            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
            setMessages((prev) => prev.filter(msg => msg.id !== payload.old.id));
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                // console.log('Subscribed to realtime messages');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('Realtime subscription error. Check if Realtime is enabled in Supabase Dashboard.');
            }
        });

    return () => {
        supabase.removeChannel(channel);
    };
  }, [user.id]);

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Sending...';
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setMediaFiles(prev => [...prev, ...files]);
      
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setMediaPreviews(prev => [...prev, ...newPreviews]);
    }
    // Reset file input so same files can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearMedia = () => {
    setMediaFiles([]);
    setMediaPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && mediaFiles.length === 0) return;

    setLoading(true);
    setUploading(mediaFiles.length > 0);

    try {
      // 1. Upload all files first
      const uploadedMedia = [];
      
      for (const file of mediaFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;
        const fileSize = formatFileSize(file.size);

        const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);
            
        uploadedMedia.push({
            url: publicUrl,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            size: fileSize
        });
      }

      // 2. Send messages
      if (newMessage.trim()) {
         const { error } = await supabase.from('messages').insert({
            text: newMessage,
            uid: user.id,
            display_name: user.user_metadata?.display_name || 'Unknown',
            photo_url: user.user_metadata?.photo_url || '',
            media_url: '',
            media_type: null,
          });
          if (error) throw error;
      }

      // Send media messages
      for (const media of uploadedMedia) {
          const { error } = await supabase.from('messages').insert({
            text: '', 
            uid: user.id,
            display_name: user.user_metadata?.display_name || 'Unknown',
            photo_url: user.user_metadata?.photo_url || '',
            media_url: media.url,
            media_type: media.type as any,
            media_size: media.size
          });
          if (error) throw error;
      }

      setNewMessage('');
      clearMedia();
    } catch (error: any) {
      console.error("Error sending message: ", error);
      alert(`Failed to send message: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download media');
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      const { error } = await supabase.from('messages').delete().eq('id', msgId);
      
      if (error) {
        throw error;
      }
      
      // Optimistically remove from UI
      setMessages(prev => prev.filter(m => m.id !== msgId));
      
    } catch (error: any) {
      console.error("Error deleting message:", error);
      alert(`Delete Failed: ${error.message}\n\nMake sure you have run the SQL code to enable Delete permissions.`);
    }
  };

  if (missingTables) {
    return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
            <div className="bg-slate-800 p-8 rounded-2xl border border-red-500/50 shadow-2xl max-w-2xl w-full">
                <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Database className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Database Setup Required</h2>
                <p className="text-slate-400 mb-6">
                    The app is connected to Supabase, but the <strong>Tables</strong> are missing.
                </p>
                
                <div className="text-left bg-black/50 p-4 rounded-lg border border-slate-700 mb-6 overflow-x-auto">
                    <p className="text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">Run this in Supabase SQL Editor:</p>
                    <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap select-all">
{`-- 1. Create Messages Table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  text text,
  uid uuid not null,
  display_name text,
  photo_url text,
  media_url text,
  media_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Security
alter table public.messages enable row level security;
create policy "Public Read" on public.messages for select to public using (true);
create policy "Public Insert" on public.messages for insert to public with check (true);
create policy "User Delete" on public.messages for delete to public using (uid = auth.uid());

-- 3. Storage
insert into storage.buckets (id, name, public) values ('chat-media', 'chat-media', true);
create policy "Public Access" on storage.objects for select to public using ( bucket_id = 'chat-media' );
create policy "Upload Access" on storage.objects for insert to public with check ( bucket_id = 'chat-media' );`}
                    </pre>
                </div>

                <button 
                    onClick={() => window.location.reload()}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full"
                >
                    I've Run the Code, Reload App
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 relative">
      {/* Group Info Overlay */}
      {showGroupInfo && (
        <GroupInfo 
            user={user} 
            onClose={() => setShowGroupInfo(false)} 
            currentGroupName={groupName}
            currentGroupImage={groupImage}
            onUpdateGroup={(name, image) => {
                setGroupName(name);
                setGroupImage(image);
            }}
        />
      )}

      {/* Header */}
      <header className={cn(
        "px-4 py-3 flex items-center justify-between shadow-md z-10 border-b transition-colors",
        isSelectionMode ? "bg-[#005c4b] border-[#005c4b]" : "bg-[#202c33] border-[#2a3942]"
      )}>
        {isSelectionMode ? (
            <div className="flex items-center w-full justify-between text-white">
                <div className="flex items-center gap-4">
                    <button onClick={handleCancelSelection}>
                        <X className="w-6 h-6" />
                    </button>
                    <span className="font-bold text-lg">{selectedMsgIds.size} Selected</span>
                </div>
                <button 
                    onClick={handleDeleteSelected}
                    className="p-2 hover:bg-black/20 rounded-full transition-colors"
                >
                    <Trash2 className="w-6 h-6" />
                </button>
            </div>
        ) : (
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowGroupInfo(true)}>
            <div className="relative">
                <img 
                    src={groupImage} 
                    alt="Group" 
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#00a884]" 
                    referrerPolicy="no-referrer"
                />
            </div>
            <div>
                <h1 className="font-bold text-lg leading-tight text-[#e9edef]">{groupName}</h1>
                <p className="text-xs text-[#8696a0] truncate max-w-[200px]">
                Tap here for group info
                </p>
            </div>
            </div>
        )}
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0b141a] relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        
        {Array.isArray(messages) && messages.map((msg) => {
          const isMe = msg.uid === user.id;
          const isSelected = selectedMsgIds.has(msg.id);
          
          return (
            <div
              key={msg.id}
              className={cn(
                "flex w-full items-end gap-2 relative z-10 group transition-colors p-1 rounded",
                isMe ? "justify-end" : "justify-start",
                isSelected ? "bg-[#005c4b]/30" : ""
              )}
              onClick={() => handleMessageClick(msg.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleLongPress(msg.id);
              }}
              onTouchStart={() => handleTouchStart(msg.id)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd} // Cancel if scrolling
            >
              {/* Selection Checkbox (Visible only in selection mode) */}
              {isSelectionMode && (
                  <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center mr-2",
                      isSelected ? "bg-[#00a884] border-[#00a884]" : "border-slate-500"
                  )}>
                      {isSelected && <div className="w-3 h-3 bg-white rounded-sm" />}
                  </div>
              )}

              {/* Avatar for everyone */}
              <img 
                src={msg.photo_url || "https://via.placeholder.com/30"} 
                alt={msg.display_name} 
                className={cn(
                    "w-8 h-8 rounded-full object-cover mb-1 shadow-sm border border-slate-700",
                    isMe ? "order-2 ml-2" : "order-1 mr-2"
                )}
                referrerPolicy="no-referrer"
              />

              <div
                className={cn(
                  "relative px-3 py-2 rounded-2xl shadow-md text-sm break-words max-w-[75%] md:max-w-[60%]",
                  isMe 
                    ? "bg-[#005c4b] text-[#e9edef] rounded-br-none order-1" 
                    : "bg-[#202c33] text-[#e9edef] rounded-bl-none order-2"
                )}
              >
                {/* Name Display (Top) - Showing for everyone */}
                <div className={cn(
                    "text-[12px] font-bold mb-1",
                    isMe ? "text-[#aebac1] text-right" : "text-[#53bdeb]"
                )}>
                    {isMe ? 'You' : (msg.display_name || 'Unknown')}
                </div>

                {/* Media Display */}
                {msg.media_url && (
                  <div className="mb-2 rounded-lg overflow-hidden bg-black/20 relative group/media">
                    {msg.media_type === 'video' ? (
                      <video src={msg.media_url} controls className="max-w-full max-h-[300px]" />
                    ) : (
                      <img 
                        src={msg.media_url} 
                        alt="Shared media" 
                        className="max-w-full max-h-[300px] object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    )}
                    
                    {/* Download Button Overlay */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.media_url!, `media_${msg.id}.${msg.media_type === 'video' ? 'mp4' : 'jpg'}`);
                        }}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover/media:opacity-100"
                        title="Download to Gallery"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {msg.text || ''}
                </p>
                
                <div className="flex items-center justify-end gap-1 mt-1 select-none">
                    <div className="text-[10px] text-[#8696a0]">
                        {formatTime(msg.created_at)}
                    </div>
                </div>
              </div>

              {/* Avatar handled above */}
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#202c33] px-4 py-3 border-t border-[#2a3942] z-20">
        {mediaFiles.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
            {mediaFiles.map((file, index) => (
                <div key={index} className="relative flex-shrink-0 bg-[#2a3942] p-1 rounded-lg border border-[#374248]">
                    {file.type.startsWith('video/') ? (
                        <div className="w-16 h-16 bg-black flex items-center justify-center rounded">
                            <PlayCircle className="text-white w-8 h-8" />
                        </div>
                    ) : (
                        <img src={mediaPreviews[index]} alt="Preview" className="w-16 h-16 object-cover rounded" />
                    )}
                    <button 
                        onClick={() => removeMedia(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md z-10"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
          </div>
        )}
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#8696a0] hover:text-[#aebac1] transition-colors"
            >
                <Paperclip className="w-6 h-6" />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,video/*" 
                multiple
                onChange={handleFileSelect}
            />
            
            <form onSubmit={handleSend} className="flex-1 flex items-center gap-2">
            <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 py-2.5 px-4 rounded-lg border border-[#2a3942] focus:ring-0 focus:border-[#2a3942] bg-[#2a3942] text-[#d1d7db] placeholder-[#8696a0] outline-none transition-all"
            />
            <button
                type="submit"
                disabled={(!newMessage.trim() && mediaFiles.length === 0) || loading || uploading}
                className="p-2.5 bg-[#00a884] text-white rounded-full hover:bg-[#008f70] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
            </form>
        </div>
      </div>
    </div>
  );
}
