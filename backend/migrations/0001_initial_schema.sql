-- SonoriaFM Initial Schema Migration
-- Generated from Drizzle schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'artist', 'listener');
CREATE TYPE track_genre AS ENUM ('electrónica', 'pop latino', 'pop rock latino', 'urbano/reguetón', 'baladas', 'pop rock', 'Otros');
CREATE TYPE track_language AS ENUM ('Español', 'Otros idiomas');
CREATE TYPE radio_queue_kind AS ENUM ('song', 'jingle', 'ad');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected', 'claimed');
CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(100) NOT NULL,
  role user_role DEFAULT 'listener' NOT NULL,
  avatar_url VARCHAR(500),
  mfa_enabled BOOLEAN DEFAULT false NOT NULL,
  mfa_secret VARCHAR(32),
  email_verified BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX users_email_idx ON users (email);
CREATE INDEX users_role_idx ON users (role);

-- Artists table
CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  name VARCHAR(100) NOT NULL,
  bio TEXT,
  cover_url VARCHAR(500),
  social_links JSONB DEFAULT '{}' NOT NULL,
  likes INTEGER DEFAULT 0 NOT NULL,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX artists_name_idx ON artists (name);
CREATE INDEX artists_likes_idx ON artists (likes);

-- Tracks table
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  cover_url VARCHAR(500),
  description TEXT,
  played_at TIMESTAMPTZ,
  genre track_genre DEFAULT 'Otros' NOT NULL,
  duration VARCHAR(10),
  duration_seconds INTEGER,
  year INTEGER,
  album VARCHAR(100),
  audio_url VARCHAR(500) NOT NULL,
  likes INTEGER DEFAULT 0 NOT NULL,
  language track_language DEFAULT 'Español' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX tracks_artist_idx ON tracks (artist_id);
CREATE INDEX tracks_genre_idx ON tracks (genre);
CREATE INDEX tracks_played_at_idx ON tracks (played_at);
CREATE INDEX tracks_likes_idx ON tracks (likes);
CREATE INDEX tracks_created_at_idx ON tracks (created_at);

-- Programs table
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  host VARCHAR(100),
  day VARCHAR(3) NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  description TEXT,
  genre VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX programs_day_idx ON programs (day);
CREATE INDEX programs_time_idx ON programs (start_time, end_time);

-- Radio Queue table
CREATE TABLE radio_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq INTEGER NOT NULL UNIQUE,
  kind radio_queue_kind DEFAULT 'song' NOT NULL,
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  artist VARCHAR(100) NOT NULL,
  genre VARCHAR(50),
  language VARCHAR(20),
  audio_url VARCHAR(500) NOT NULL,
  cover_url VARCHAR(500),
  duration VARCHAR(10),
  duration_ms INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  slot_key INTEGER NOT NULL,
  k INTEGER DEFAULT 0,
  pos INTEGER DEFAULT 0,
  "order" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX radio_queue_seq_idx ON radio_queue (seq);
CREATE INDEX radio_queue_starts_at_idx ON radio_queue (starts_at);
CREATE INDEX radio_queue_ends_at_idx ON radio_queue (ends_at);
CREATE INDEX radio_queue_slot_key_idx ON radio_queue (slot_key);

-- Track Likes table
CREATE TABLE track_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX track_likes_unique_idx ON track_likes (track_id, user_id);
CREATE INDEX track_likes_track_idx ON track_likes (track_id);
CREATE INDEX track_likes_user_idx ON track_likes (user_id);

-- Submissions table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_name VARCHAR(100) NOT NULL,
  artist_email VARCHAR(255) NOT NULL,
  track_title VARCHAR(200) NOT NULL,
  track_genre track_genre DEFAULT 'Otros' NOT NULL,
  track_language track_language DEFAULT 'Español' NOT NULL,
  audio_url VARCHAR(500) NOT NULL,
  cover_url VARCHAR(500),
  description TEXT,
  status submission_status DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX submissions_status_idx ON submissions (status);
CREATE INDEX submissions_artist_email_idx ON submissions (artist_email);

-- Pending Submissions table
CREATE TABLE pending_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE NOT NULL,
  claim_token VARCHAR(64) NOT NULL UNIQUE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX pending_submissions_submission_idx ON pending_submissions (submission_id);
CREATE INDEX pending_submissions_artist_idx ON pending_submissions (artist_id);

-- Articles table
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_url VARCHAR(500),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status article_status DEFAULT 'draft' NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX articles_slug_idx ON articles (slug);
CREATE INDEX articles_status_idx ON articles (status);
CREATE INDEX articles_published_at_idx ON articles (published_at);

-- Suggestions table
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(100),
  email VARCHAR(255),
  category VARCHAR(50),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Contact Messages table
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new' NOT NULL,
  replied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Listen Events table (analytics)
CREATE TABLE listen_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  position_ms INTEGER,
  duration_ms INTEGER,
  user_agent TEXT,
  ip_hash VARCHAR(64),
  country VARCHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX listen_events_track_idx ON listen_events (track_id);
CREATE INDEX listen_events_session_idx ON listen_events (session_id);
CREATE INDEX listen_events_type_idx ON listen_events (event_type);
CREATE INDEX listen_events_created_at_idx ON listen_events (created_at);

-- Genre Options table
CREATE TABLE genre_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  track_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Marketing Contacts table
CREATE TABLE marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  source VARCHAR(50),
  subscribed BOOLEAN DEFAULT true NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX marketing_contacts_email_idx ON marketing_contacts (email);

-- Prospects table
CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  artist_name VARCHAR(100),
  message TEXT,
  status VARCHAR(20) DEFAULT 'new' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX prospects_email_idx ON prospects (email);
CREATE INDEX prospects_status_idx ON prospects (status);

-- Top Week table
CREATE TABLE top_week (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE NOT NULL,
  week_start TIMESTAMPTZ NOT NULL,
  position INTEGER NOT NULL,
  likes_snapshot INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX top_week_unique_idx ON top_week (track_id, week_start);
CREATE INDEX top_week_week_idx ON top_week (week_start);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suggestions_updated_at BEFORE UPDATE ON suggestions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_messages_updated_at BEFORE UPDATE ON contact_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();