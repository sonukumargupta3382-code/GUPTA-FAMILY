import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Image as ImageIcon, Loader2, Trash2, Paperclip, X, PlayCircle, LogOut } from 'lucide-react';
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
  created_at: string;
}

export function Chat({ user }: { user: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupName, setGroupName] = useState("GUPTA FAMILY");
  const [groupImage, setGroupImage] = useState("https://ui-avatars.com/api/?name=Gupta+Family&background=0D8ABC&color=fff");
  
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
                // If table doesn't exist, don't crash, just show empty or alert
                if (error.code === '42P01') {
                    alert("Database tables are missing! Please go to the Login screen -> '?' Help -> Step 3 to run the SQL code.");
                }
            } else {
                setMessages(data || []);
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
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !mediaFile) return;

    setLoading(true);
    setUploading(!!mediaFile);

    try {
      let media_url = '';
      let media_type: 'image' | 'video' | null = null;

      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);
            
        media_url = publicUrl;
        media_type = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const { error } = await supabase.from('messages').insert({
        text: newMessage,
        uid: user.id,
        display_name: user.user_metadata?.display_name || 'Unknown',
        photo_url: user.user_metadata?.photo_url || '',
        media_url,
        media_type,
      });

      if (error) throw error;

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

  const handleDelete = async (msgId: string) => {
    if (window.confirm("Delete this message?")) {
      try {
        await supabase.from('messages').delete().eq('id', msgId);
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 relative">
      {/* Group Info Overlay */}
      {showGroupInfo && <GroupInfo user={user} onClose={() => setShowGroupInfo(false)} />}

      {/* Header */}
      <header className="bg-[#202c33] text-[#e9edef] px-4 py-3 flex items-center justify-between shadow-md z-10 border-b border-[#2a3942]">
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
        <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            className="p-2 text-[#8696a0] hover:text-red-400 transition-colors"
        >
            <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0b141a] relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        
        {Array.isArray(messages) && messages.map((msg) => {
          const isMe = msg.uid === user.id;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex w-full items-end gap-2 relative z-10 group",
                isMe ? "justify-end" : "justify-start"
              )}
            >
              {/* Other User Photo (Left) */}
              {!isMe && (
                  <img 
                    src={msg.photo_url || "https://via.placeholder.com/30"} 
                    alt={msg.display_name} 
                    className="w-8 h-8 rounded-full object-cover mb-1 shadow-sm border border-slate-700"
                    referrerPolicy="no-referrer"
                  />
              )}

              <div
                className={cn(
                  "relative px-3 py-2 rounded-2xl shadow-md text-sm break-words max-w-[75%] md:max-w-[60%]",
                  isMe 
                    ? "bg-[#005c4b] text-[#e9edef] rounded-br-none" 
                    : "bg-[#202c33] text-[#e9edef] rounded-bl-none"
                )}
              >
                {/* Name Display (Top) */}
                {!isMe && (
                    <div className="text-[12px] font-bold mb-1 text-[#53bdeb]">
                        {msg.display_name || 'Unknown'}
                    </div>
                )}

                {/* Media Display */}
                {msg.media_url && (
                  <div className="mb-2 rounded-lg overflow-hidden bg-black/20">
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
                  </div>
                )}

                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {msg.text || ''}
                </p>
                
                <div className="flex items-center justify-end gap-1 mt-1 select-none">
                    <div className="text-[10px] text-[#8696a0]">
                        {formatTime(msg.created_at)}
                    </div>
                    {isMe && (
                        <button 
                            onClick={() => handleDelete(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8696a0] hover:text-red-400 ml-1"
                            title="Delete Message"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
              </div>

              {/* My Photo (Right) */}
              {isMe && (
                  <img 
                    src={msg.photo_url || "https://via.placeholder.com/30"} 
                    alt={msg.display_name} 
                    className="w-8 h-8 rounded-full object-cover mb-1 shadow-sm border border-indigo-500"
                    referrerPolicy="no-referrer"
                  />
              )}
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#202c33] px-4 py-3 border-t border-[#2a3942] z-20">
        {mediaPreview && (
          <div className="flex items-center gap-2 mb-2 bg-[#2a3942] p-2 rounded-lg w-fit shadow-sm border border-[#374248]">
            <div className="relative">
                {mediaFile?.type.startsWith('video/') ? (
                    <div className="w-16 h-16 bg-black flex items-center justify-center rounded">
                        <PlayCircle className="text-white w-8 h-8" />
                    </div>
                ) : (
                    <img src={mediaPreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                )}
                <button 
                    onClick={clearMedia}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
            <span className="text-xs text-[#8696a0] max-w-[100px] truncate">{mediaFile?.name}</span>
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
                disabled={(!newMessage.trim() && !mediaFile) || loading || uploading}
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
