import React from 'react';
import { X, Database, Key, Table, Shield, HardDrive, Zap } from 'lucide-react';

interface SetupGuideProps {
  onClose: () => void;
}

export function SetupGuide({ onClose }: SetupGuideProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="text-indigo-400" />
            Supabase Setup Guide
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 text-slate-300">
          
          {/* Step 1: Create Project */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="bg-indigo-600 text-xs px-2 py-1 rounded">Step 1</span>
              Create Project
            </h3>
            <p>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">supabase.com</a>, sign in, and click <strong>"New Project"</strong>.</p>
          </section>

          {/* Step 2: Get Keys */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="bg-indigo-600 text-xs px-2 py-1 rounded">Step 2</span>
              Get API Keys <Key className="w-4 h-4 text-slate-400" />
            </h3>
            <p className="mb-2">Go to <strong>Project Settings</strong> (gear icon) → <strong>API</strong>.</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Copy <strong>Project URL</strong></li>
              <li>Copy <strong>anon public</strong> Key</li>
            </ul>
            <p className="mt-2 text-sm bg-slate-900 p-3 rounded border border-slate-700">
              Paste these keys into your <code>.env</code> file or provide them to the developer.
            </p>
          </section>

          {/* Step 3: Database Setup */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="bg-indigo-600 text-xs px-2 py-1 rounded">Step 3</span>
              Create Tables (SQL) <Table className="w-4 h-4 text-slate-400" />
            </h3>
            <p className="mb-3">Go to <strong>SQL Editor</strong> (left sidebar) → <strong>New Query</strong>. Paste and run this code:</p>
            <div className="bg-black/50 p-4 rounded-lg border border-slate-700 font-mono text-xs text-emerald-400 overflow-x-auto">
              <pre>{`-- 1. Create Messages Table
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

-- 2. Create Users Table (Optional but recommended)
create table public.users (
  id uuid references auth.users not null primary key,
  email text,
  display_name text,
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Security (RLS)
alter table public.messages enable row level security;
alter table public.users enable row level security;

-- 4. Create Policies (Access Rules)
create policy "Public Read Messages" 
on public.messages for select to public using (true);

create policy "Public Insert Messages" 
on public.messages for insert to public with check (true);

create policy "User Delete Own Messages" 
on public.messages for delete to public using (uid = auth.uid());

create policy "Public Read Users" 
on public.users for select to public using (true);

create policy "User Update Own Profile" 
on public.users for update using (auth.uid() = id);

create policy "User Insert Own Profile" 
on public.users for insert with check (auth.uid() = id);
`}</pre>
            </div>
          </section>

          {/* Step 4: Storage Setup */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="bg-indigo-600 text-xs px-2 py-1 rounded">Step 4</span>
              Setup Storage <HardDrive className="w-4 h-4 text-slate-400" />
            </h3>
            <p className="mb-3">Run this SQL to create the storage bucket for photos/videos:</p>
            <div className="bg-black/50 p-4 rounded-lg border border-slate-700 font-mono text-xs text-emerald-400 overflow-x-auto">
              <pre>{`-- Create Bucket
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true);

-- Allow Public Access
create policy "Public Access"
on storage.objects for select to public using ( bucket_id = 'chat-media' );

-- Allow Uploads
create policy "Upload Access"
on storage.objects for insert to public with check ( bucket_id = 'chat-media' );
`}</pre>
            </div>
          </section>

          {/* Step 5: Enable Realtime */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="bg-indigo-600 text-xs px-2 py-1 rounded">Step 5</span>
              Enable Realtime (Chat) <Zap className="w-4 h-4 text-yellow-400" />
            </h3>
            <p className="mb-2">To see messages instantly without refreshing:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Go to <strong>Database</strong> (sidebar) → <strong>Publications</strong>.</li>
              <li>Click on <strong>supabase_realtime</strong>.</li>
              <li>Toggle the switch <strong>ON</strong> for the <code>messages</code> table.</li>
            </ul>
          </section>

          {/* Step 6: Auth Settings */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="bg-indigo-600 text-xs px-2 py-1 rounded">Step 6</span>
              Auth Settings <Shield className="w-4 h-4 text-slate-400" />
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Go to <strong>Authentication</strong> → <strong>Providers</strong> → <strong>Email</strong>.</li>
              <li>Turn <strong>OFF</strong> "Confirm email" (unless you want to verify emails).</li>
              <li>Click <strong>Save</strong>.</li>
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 bg-slate-900/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
