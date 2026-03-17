-- ============================================
-- Dokita AI — Supabase Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable the pgvector extension
create extension if not exists vector;

-- Books table: tracks all indexed documents
create table if not exists books (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  filename text not null,
  drive_file_id text,
  drive_link text,
  subject text default 'General Medicine',
  chunk_count integer default 0,
  status text default 'indexing', -- indexing | ready | error
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chunks table: stores text chunks + their embeddings
create table if not exists chunks (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references books(id) on delete cascade,
  book_title text not null,
  subject text default 'General Medicine',
  chunk_index integer not null,
  content text not null,
  page_hint text, -- e.g. "Chapter 5" or "Page 120"
  embedding vector(768), -- Gemini text-embedding-004 dimension
  created_at timestamp with time zone default now()
);

-- Analytics table: tracks what users ask
create table if not exists query_log (
  id uuid default gen_random_uuid() primary key,
  query text not null,
  mode text default 'chat', -- chat | symptom | drug | quiz
  language text default 'en',
  matched_books text[],
  created_at timestamp with time zone default now()
);

-- Bookmarks table: saved answers
create table if not exists bookmarks (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  query text not null,
  answer text not null,
  sources text[],
  created_at timestamp with time zone default now()
);

-- Create similarity search function
create or replace function match_chunks(
  query_embedding vector(768),
  match_count int default 5,
  filter_subject text default null
)
returns table (
  id uuid,
  book_title text,
  subject text,
  content text,
  page_hint text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chunks.id,
    chunks.book_title,
    chunks.subject,
    chunks.content,
    chunks.page_hint,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where
    (filter_subject is null or chunks.subject = filter_subject)
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Index for fast vector search
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Row Level Security
alter table books enable row level security;
alter table chunks enable row level security;
alter table query_log enable row level security;
alter table bookmarks enable row level security;

-- Allow public read on books and chunks (for chat)
create policy "Public can read books" on books for select using (true);
create policy "Public can read chunks" on chunks for select using (true);
create policy "Anyone can insert query log" on query_log for insert with check (true);
create policy "Anyone can manage bookmarks" on bookmarks for all using (true);

-- Only service role can insert/update books and chunks
create policy "Service role manages books" on books
  for all using (auth.role() = 'service_role');
create policy "Service role manages chunks" on chunks
  for all using (auth.role() = 'service_role');
