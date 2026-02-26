import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Camera, Edit2, Save, Loader2, Info, LogOut } from 'lucide-react';

interface UserData {
  id: string;
  display_name: string;
  photo_url: string;
  email: string;
}

interface GroupInfoProps {
  user: any;
  onClose: () => void;
}

export function GroupInfo({ user, onClose }: GroupInfoProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [groupName, setGroupName] = useState("GUPTA FAMILY");
  const [groupImage, setGroupImage] = useState("https://ui-avatars.com/api/?name=Gupta+Family&background=0D8ABC&color=fff");
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(groupName);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  // My Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newName, setNewName] = useState(user.user_metadata.display_name || '');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Fetch Users
    const fetchUsers = async () => {
        // In a real Supabase app, you might query a 'profiles' table.
        // For now, we'll just mock it or fetch distinct users from messages if no profiles table exists.
        // Or better, let's assume we are using the 'users' table if we created one, or just list the current user.
        // Since we don't have a robust user list system yet, I'll just show the current user and maybe fetch others from messages.
        
        const { data, error } = await supabase
            .from('messages')
            .select('uid, display_name, photo_url')
            .order('created_at', { ascending: false });

        if (data) {
            // Deduplicate users based on uid
            const uniqueUsers = Array.from(new Map(data.map(item => [item.uid, item])).values()).map(u => ({
                id: u.uid,
                display_name: u.display_name,
                photo_url: u.photo_url,
                email: 'Hidden' // Email is private usually
            }));
            setUsers(uniqueUsers);
        }
    };

    fetchUsers();

    // Fetch Group Info (Mocked or from a settings table if it existed)
    // For now, we keep local state or could use a 'settings' table
    const fetchGroupSettings = async () => {
        const { data } = await supabase.from('settings').select('*').eq('id', 'group_info').single();
        if (data) {
            if (data.name) setGroupName(data.name);
            if (data.photo_url) setGroupImage(data.photo_url);
        }
    };
    fetchGroupSettings();

  }, []);

  const handleUpdateGroupImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `group_icon_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);
        
        // Update in Supabase (assuming a settings table, or just local state for this demo)
        // await supabase.from('settings').upsert({ id: 'group_info', photo_url: publicUrl });
        
        setGroupImage(publicUrl);
      } catch (error) {
        console.error("Error updating group icon:", error);
        alert("Failed to update group icon.");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleUpdateGroupName = async () => {
    if (!newGroupName.trim()) return;
    try {
        // await supabase.from('settings').upsert({ id: 'group_info', name: newGroupName });
        setGroupName(newGroupName);
        setIsEditingName(false);
    } catch (error) {
        console.error("Error updating group name:", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) return;
    setUploading(true);
    try {
        const { error } = await supabase.auth.updateUser({
            data: { display_name: newName }
        });

        if (error) throw error;
        
        // Also update in messages for consistency? No, historical messages usually keep old name, 
        // but for this simple app we might want to update future messages.
        
        setIsEditingProfile(false);
        window.location.reload(); // Reload to reflect changes
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile.");
    } finally {
        setUploading(false);
    }
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `profile_${user.id}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filePath);
            
            const { error } = await supabase.auth.updateUser({
                data: { photo_url: publicUrl }
            });

            if (error) throw error;
            
            window.location.reload();
        } catch (error) {
            console.error("Error updating profile photo:", error);
            alert("Failed to update photo.");
        } finally {
            setUploading(false);
        }
    }
  };

  if (fullScreenImage) {
      return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setFullScreenImage(null)}>
              <img src={fullScreenImage} alt="Full Screen" className="max-w-full max-h-full object-contain" />
              <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20">
                  <X className="w-6 h-6" />
              </button>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#111b21] flex flex-col animate-in slide-in-from-right duration-300 text-[#e9edef]">
      {/* Header */}
      <div className="bg-[#202c33] text-[#e9edef] p-4 flex items-center gap-4 shadow-md">
        <button onClick={onClose} className="p-2 hover:bg-[#374248] rounded-full transition-colors">
            <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-medium">Group Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Group Icon & Name */}
        <div className="flex flex-col items-center py-6 bg-[#111b21]">
            <div className="relative group">
                <img 
                    src={groupImage} 
                    alt="Group Icon" 
                    className="w-40 h-40 rounded-full object-cover shadow-lg cursor-pointer border-4 border-[#202c33]"
                    onClick={() => setFullScreenImage(groupImage)}
                    referrerPolicy="no-referrer"
                />
                <label className="absolute bottom-2 right-2 bg-[#00a884] text-white p-3 rounded-full cursor-pointer shadow-lg hover:bg-[#008f70] transition-colors">
                    <Camera className="w-6 h-6" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpdateGroupImage} disabled={uploading} />
                </label>
            </div>
            
            <div className="mt-6 flex items-center gap-3 justify-center w-full">
                {isEditingName ? (
                    <div className="flex items-center gap-2 w-full max-w-xs">
                        <input 
                            type="text" 
                            value={newGroupName} 
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="flex-1 bg-[#2a3942] border-b-2 border-[#00a884] px-2 py-1 text-xl text-[#e9edef] focus:outline-none"
                            autoFocus
                        />
                        <button onClick={handleUpdateGroupName} className="text-[#00a884] p-2 hover:bg-[#202c33] rounded-full">
                            <Save className="w-6 h-6" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-medium text-[#e9edef]">{groupName}</h1>
                        <button onClick={() => setIsEditingName(true)} className="text-[#00a884] hover:bg-[#202c33] p-2 rounded-full transition-colors">
                            <Edit2 className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
            <p className="text-[#8696a0] mt-1">{users.length} participants</p>
        </div>

        {/* My Profile Section */}
        <div className="bg-[#202c33] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-[#00a884] text-sm uppercase tracking-wider">My Profile</h3>
                <button 
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="text-[#8696a0] hover:text-[#e9edef] transition-colors"
                >
                    {isEditingProfile ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </button>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="relative">
                    <img 
                        src={user.user_metadata.photo_url || "https://via.placeholder.com/150"} 
                        alt="My Profile" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#2a3942]"
                        onClick={() => setFullScreenImage(user.user_metadata.photo_url)}
                        referrerPolicy="no-referrer"
                    />
                    {isEditingProfile && (
                        <label className="absolute -bottom-1 -right-1 bg-[#00a884] text-white p-1.5 rounded-full cursor-pointer shadow-sm hover:bg-[#008f70]">
                            <Camera className="w-3 h-3" />
                            <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} disabled={uploading} />
                        </label>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    {isEditingProfile ? (
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                value={newName} 
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-[#2a3942] border-b-2 border-[#00a884] px-2 py-1 text-[#e9edef] focus:outline-none"
                            />
                            <button onClick={handleUpdateProfile} disabled={uploading} className="text-[#00a884] p-2 hover:bg-[#374248] rounded-full">
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="font-medium text-[#e9edef] text-lg truncate">{user.user_metadata.display_name}</p>
                            <p className="text-sm text-[#8696a0] truncate">{user.email}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Members List */}
        <div className="bg-[#202c33] rounded-xl shadow-sm overflow-hidden">
            <h3 className="font-medium text-[#8696a0] text-sm p-4 pb-2">Participants: {users.length}</h3>
            <div className="divide-y divide-[#2a3942]">
                {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-[#111b21] transition-colors cursor-pointer">
                        <img 
                            src={u.photo_url || "https://via.placeholder.com/40"} 
                            alt={u.display_name} 
                            className="w-10 h-10 rounded-full object-cover border border-[#2a3942]"
                            onClick={() => setFullScreenImage(u.photo_url)}
                            referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#e9edef] text-base truncate">
                                {u.display_name} {u.id === user.id && <span className="text-[#8696a0] text-sm font-normal">(You)</span>}
                            </p>
                            {/* <p className="text-xs text-[#8696a0] truncate">{u.email}</p> */}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <button 
            onClick={() => {
                supabase.auth.signOut().then(() => window.location.reload());
            }}
            className="w-full flex items-center justify-center gap-3 bg-[#202c33] text-[#ef4444] py-4 rounded-xl font-medium hover:bg-[#374248] transition-colors shadow-sm mt-8"
        >
            <LogOut className="w-5 h-5" />
            Exit Group (Logout)
        </button>
      </div>
    </div>
  );
}
