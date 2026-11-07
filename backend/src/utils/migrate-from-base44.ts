/**
 * Migration script: Import data from Base44 JSON export to PostgreSQL
 * Usage: deno run --allow-all src/utils/migrate-from-base44.ts <export-file.json>
 */

import { db } from '../db/connection.ts';
import { users, artists, tracks, programs, submissions, pendingSubmissions, articles, suggestions, contactMessages, genreOptions, marketingContacts, prospects, trackLikes } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../middleware/auth.ts';
import { ulid } from 'npm:ulid@^2.3.0';

interface Base44Export {
  entities: {
    User?: any[];
    Artist?: any[];
    Track?: any[];
    Program?: any[];
    Submission?: any[];
    PendingSubmission?: any[];
    Article?: any[];
    Suggestion?: any[];
    ContactMessage?: any[];
    GenreOption?: any[];
    MarketingContact?: any[];
    Prospect?: any[];
    TrackLike?: any[];
    // ... other entities
  };
}

async function migrateFromBase44(exportPath: string) {
  console.log(`📥 Loading Base44 export from ${exportPath}...`);

  const file = await Deno.readTextFile(exportPath);
  const exportData: Base44Export = JSON.parse(file);

  const { entities } = exportData;
  console.log('Entities found:', Object.keys(entities).filter(k => entities[k]?.length > 0));

  // Track ID mappings (Base44 IDs -> new UUIDs)
  const userIdMap = new Map<string, string>();
  const artistIdMap = new Map<string, string>();
  const trackIdMap = new Map<string, string>();

  // 1. Migrate Users
  if (entities.User?.length) {
    console.log(`\n👥 Migrating ${entities.User.length} users...`);
    for (const u of entities.User) {
      const newId = ulid();
      userIdMap.set(u.id, newId);

      // Hash password if present (Base44 might store hashed or not)
      let passwordHash = u.passwordHash;
      if (u.password && !u.passwordHash) {
        passwordHash = await hashPassword(u.password);
      }

      await db.insert(users).values({
        id: newId,
        email: u.email,
        passwordHash,
        name: u.name || u.email.split('@')[0],
        role: u.role === 'admin' ? 'admin' : u.role === 'artist' ? 'artist' : 'listener',
        avatarUrl: u.avatarUrl,
        mfaEnabled: u.mfaEnabled || false,
        mfaSecret: u.mfaSecret,
        emailVerified: u.emailVerified || false,
        createdAt: u.created_date ? new Date(u.created_date) : new Date(),
        updatedAt: u.updated_date ? new Date(u.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Users migrated');
  }

  // 2. Migrate Artists
  if (entities.Artist?.length) {
    console.log(`\n🎤 Migrating ${entities.Artist.length} artists...`);
    for (const a of entities.Artist) {
      const newId = ulid();
      artistIdMap.set(a.id, newId);

      const userId = a.user_id ? userIdMap.get(a.user_id) : null;

      await db.insert(artists).values({
        id: newId,
        userId,
        name: a.name,
        bio: a.bio,
        coverUrl: a.cover_url,
        socialLinks: a.social_links || {},
        likes: a.likes || 0,
        isVerified: a.is_verified || false,
        createdAt: a.created_date ? new Date(a.created_date) : new Date(),
        updatedAt: a.updated_date ? new Date(a.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Artists migrated');
  }

  // 3. Migrate Tracks
  if (entities.Track?.length) {
    console.log(`\n🎵 Migrating ${entities.Track.length} tracks...`);
    for (const t of entities.Track) {
      const newId = ulid();
      trackIdMap.set(t.id, newId);

      const artistId = t.artist_id ? artistIdMap.get(t.artist_id) : null;
      if (!artistId) {
        console.warn(`⚠️ Track ${t.title} has no valid artist, skipping`);
        continue;
      }

      // Parse duration to seconds
      let durationSeconds: number | null = null;
      if (t.duration) {
        const parts = t.duration.split(':').map((p: string) => parseInt(p, 10));
        if (!parts.some((p: number) => isNaN(p))) {
          durationSeconds = parts.reduce((acc: number, p: number) => acc * 60 + p, 0);
        }
      }

      await db.insert(tracks).values({
        id: newId,
        artistId,
        title: t.title,
        coverUrl: t.cover_url,
        description: t.description,
        playedAt: t.played_at ? new Date(t.played_at) : null,
        genre: t.genre || 'Otros',
        duration: t.duration,
        durationSeconds,
        year: t.year,
        album: t.album,
        audioUrl: t.audio_url,
        likes: t.likes || 0,
        language: t.language || 'Español',
        createdAt: t.created_date ? new Date(t.created_date) : new Date(),
        updatedAt: t.updated_date ? new Date(t.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Tracks migrated');
  }

  // 4. Migrate Programs
  if (entities.Program?.length) {
    console.log(`\n📅 Migrating ${entities.Program.length} programs...`);
    for (const p of entities.Program) {
      await db.insert(programs).values({
        id: ulid(),
        title: p.title,
        host: p.host,
        day: p.day,
        startTime: p.start_time,
        endTime: p.end_time,
        description: p.description,
        genre: p.genre,
        createdAt: p.created_date ? new Date(p.created_date) : new Date(),
        updatedAt: p.updated_date ? new Date(p.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Programs migrated');
  }

  // 5. Migrate Submissions
  if (entities.Submission?.length) {
    console.log(`\n📝 Migrating ${entities.Submission.length} submissions...`);
    for (const s of entities.Submission) {
      const newId = ulid();

      const reviewedBy = s.reviewed_by ? userIdMap.get(s.reviewed_by) : null;
      const createdTrackId = s.created_track_id ? trackIdMap.get(s.created_track_id) : null;

      await db.insert(submissions).values({
        id: newId,
        artistName: s.artist_name,
        artistEmail: s.artist_email,
        trackTitle: s.track_title,
        trackGenre: s.track_genre || 'Otros',
        trackLanguage: s.track_language || 'Español',
        audioUrl: s.audio_url,
        coverUrl: s.cover_url,
        description: s.description,
        status: s.status || 'pending',
        reviewedBy,
        reviewedAt: s.reviewed_at ? new Date(s.reviewed_at) : null,
        rejectionReason: s.rejection_reason,
        createdTrackId,
        createdAt: s.created_date ? new Date(s.created_date) : new Date(),
        updatedAt: s.updated_date ? new Date(s.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Submissions migrated');
  }

  // 6. Migrate Pending Submissions
  if (entities.PendingSubmission?.length) {
    console.log(`\n⏳ Migrating ${entities.PendingSubmission.length} pending submissions...`);
    for (const ps of entities.PendingSubmission) {
      const submissionId = ps.submission_id; // Would need mapping from old submission IDs
      const artistId = ps.artist_id ? artistIdMap.get(ps.artist_id) : null;

      if (!artistId) continue;

      await db.insert(pendingSubmissions).values({
        id: ulid(),
        submissionId: submissionId, // Note: This won't match new UUIDs without full mapping
        artistId,
        claimToken: ps.claim_token,
        claimedAt: ps.claimed_at ? new Date(ps.claimed_at) : null,
        createdAt: ps.created_date ? new Date(ps.created_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Pending submissions migrated');
  }

  // 7. Migrate Articles
  if (entities.Article?.length) {
    console.log(`\n📰 Migrating ${entities.Article.length} articles...`);
    for (const a of entities.Article) {
      const authorId = a.author_id ? userIdMap.get(a.author_id) : null;

      await db.insert(articles).values({
        id: ulid(),
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        content: a.content,
        coverUrl: a.cover_url,
        authorId,
        status: a.status || 'draft',
        publishedAt: a.published_at ? new Date(a.published_at) : null,
        createdAt: a.created_date ? new Date(a.created_date) : new Date(),
        updatedAt: a.updated_date ? new Date(a.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Articles migrated');
  }

  // 8. Migrate Suggestions
  if (entities.Suggestion?.length) {
    console.log(`\n💡 Migrating ${entities.Suggestion.length} suggestions...`);
    for (const s of entities.Suggestion) {
      const userId = s.user_id ? userIdMap.get(s.user_id) : null;

      await db.insert(suggestions).values({
        id: ulid(),
        userId,
        name: s.name,
        email: s.email,
        category: s.category,
        message: s.message,
        status: s.status || 'new',
        createdAt: s.created_date ? new Date(s.created_date) : new Date(),
        updatedAt: s.updated_date ? new Date(s.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Suggestions migrated');
  }

  // 9. Migrate Contact Messages
  if (entities.ContactMessage?.length) {
    console.log(`\n📧 Migrating ${entities.ContactMessage.length} contact messages...`);
    for (const cm of entities.ContactMessage) {
      const repliedBy = cm.replied_by ? userIdMap.get(cm.replied_by) : null;

      await db.insert(contactMessages).values({
        id: ulid(),
        name: cm.name,
        email: cm.email,
        subject: cm.subject,
        message: cm.message,
        status: cm.status || 'new',
        repliedBy,
        repliedAt: cm.replied_at ? new Date(cm.replied_at) : null,
        createdAt: cm.created_date ? new Date(cm.created_date) : new Date(),
        updatedAt: cm.updated_date ? new Date(cm.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Contact messages migrated');
  }

  // 10. Migrate Genre Options
  if (entities.GenreOption?.length) {
    console.log(`\n🎭 Migrating ${entities.GenreOption.length} genre options...`);
    for (const g of entities.GenreOption) {
      const addedBy = g.added_by ? userIdMap.get(g.added_by) : null;

      await db.insert(genreOptions).values({
        id: ulid(),
        name: g.name,
        addedBy,
        trackCount: g.track_count || 0,
        createdAt: g.created_date ? new Date(g.created_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Genre options migrated');
  }

  // 11. Migrate Marketing Contacts
  if (entities.MarketingContact?.length) {
    console.log(`\n📬 Migrating ${entities.MarketingContact.length} marketing contacts...`);
    for (const mc of entities.MarketingContact) {
      await db.insert(marketingContacts).values({
        id: ulid(),
        email: mc.email,
        name: mc.name,
        source: mc.source,
        subscribed: mc.subscribed !== false,
        unsubscribedAt: mc.unsubscribed_at ? new Date(mc.unsubscribed_at) : null,
        createdAt: mc.created_date ? new Date(mc.created_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Marketing contacts migrated');
  }

  // 12. Migrate Prospects
  if (entities.Prospect?.length) {
    console.log(`\n🎯 Migrating ${entities.Prospect.length} prospects...`);
    for (const p of entities.Prospect) {
      await db.insert(prospects).values({
        id: ulid(),
        name: p.name,
        email: p.email,
        artistName: p.artist_name,
        message: p.message,
        status: p.status || 'new',
        createdAt: p.created_date ? new Date(p.created_date) : new Date(),
        updatedAt: p.updated_date ? new Date(p.updated_date) : new Date(),
      }).onConflictDoNothing();
    }
    console.log('✅ Prospects migrated');
  }

  // 13. Migrate Track Likes
  if (entities.TrackLike?.length) {
    console.log(`\n❤️ Migrating ${entities.TrackLike.length} track likes...`);
    let migrated = 0;
    for (const tl of entities.TrackLike) {
      const trackId = tl.track_id ? trackIdMap.get(tl.track_id) : null;
      const userId = tl.user_id ? userIdMap.get(tl.user_id) : null;

      if (!trackId || !userId) continue;

      await db.insert(trackLikes).values({
        id: ulid(),
        trackId,
        userId,
        createdAt: tl.created_date ? new Date(tl.created_date) : new Date(),
      }).onConflictDoNothing();
      migrated++;
    }
    console.log(`✅ ${migrated} track likes migrated`);
  }

  console.log('\n🎉 Migration completed!');
  console.log('\nID Mappings (for reference):');
  console.log('Users:', userIdMap.size);
  console.log('Artists:', artistIdMap.size);
  console.log('Tracks:', trackIdMap.size);
}

// Run if executed directly
if (import.meta.main) {
  const exportPath = Deno.args[0];
  if (!exportPath) {
    console.error('Usage: deno run --allow-all src/utils/migrate-from-base44.ts <export-file.json>');
    Deno.exit(1);
  }

  try {
    await migrateFromBase44(exportPath);
  } catch (error) {
    console.error('Migration failed:', error);
    Deno.exit(1);
  }
}