import { pgTable, uuid, varchar, text, integer, timestamp, boolean, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'artist', 'listener']);
export const trackGenreEnum = pgEnum('track_genre', [
  'electrónica',
  'pop latino',
  'pop rock latino',
  'urbano/reguetón',
  'baladas',
  'pop rock',
  'Otros'
]);
export const trackLanguageEnum = pgEnum('track_language', ['Español', 'Otros idiomas']);
export const radioQueueKindEnum = pgEnum('radio_queue_kind', ['song', 'jingle', 'ad']);
export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'approved', 'rejected', 'claimed']);
export const articleStatusEnum = pgEnum('article_status', ['draft', 'published', 'archived']);

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 100 }).notNull(),
  role: userRoleEnum('role').default('listener').notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  mfaEnabled: boolean('mfa_enabled').default(false),
  mfaSecret: varchar('mfa_secret', { length: 32 }),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

// Artists (linked to users)
export const artists = pgTable('artists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique(),
  name: varchar('name', { length: 100 }).notNull(),
  bio: text('bio'),
  coverUrl: varchar('cover_url', { length: 500 }),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().default({}),
  likes: integer('likes').default(0).notNull(),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('artists_name_idx').on(table.name),
  likesIdx: index('artists_likes_idx').on(table.likes),
}));

// Tracks (songs)
export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistId: uuid('artist_id').references(() => artists.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  coverUrl: varchar('cover_url', { length: 500 }),
  description: text('description'),
  playedAt: timestamp('played_at', { withTimezone: true }),
  genre: trackGenreEnum('genre').default('Otros').notNull(),
  duration: varchar('duration', { length: 10 }), // MM:SS format
  durationSeconds: integer('duration_seconds'),
  year: integer('year'),
  album: varchar('album', { length: 100 }),
  audioUrl: varchar('audio_url', { length: 500 }).notNull(),
  likes: integer('likes').default(0).notNull(),
  language: trackLanguageEnum('language').default('Español').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  artistIdx: index('tracks_artist_idx').on(table.artistId),
  genreIdx: index('tracks_genre_idx').on(table.genre),
  playedAtIdx: index('tracks_played_at_idx').on(table.playedAt),
  likesIdx: index('tracks_likes_idx').on(table.likes),
  createdAtIdx: index('tracks_created_at_idx').on(table.createdAt),
}));

// Programs (schedule)
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 100 }).notNull(),
  host: varchar('host', { length: 100 }),
  day: varchar('day', { length: 3 }).notNull(), // Lun, Mar, Mié, Jue, Vie, Sáb, Dom
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  description: text('description'),
  genre: varchar('genre', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dayIdx: index('programs_day_idx').on(table.day),
  timeIdx: index('programs_time_idx').on(table.startTime, table.endTime),
}));

// Radio Queue (server-side emission schedule)
export const radioQueue = pgTable('radio_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  seq: integer('seq').notNull().unique(),
  kind: radioQueueKindEnum('kind').default('song').notNull(),
  trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  artist: varchar('artist', { length: 100 }).notNull(),
  genre: varchar('genre', { length: 50 }),
  language: varchar('language', { length: 20 }),
  audioUrl: varchar('audio_url', { length: 500 }).notNull(),
  coverUrl: varchar('cover_url', { length: 500 }),
  duration: varchar('duration', { length: 10 }),
  durationMs: integer('duration_ms').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  slotKey: integer('slot_key').notNull(),
  cycle: integer('k').default(0),
  position: integer('pos').default(0),
  order: text('order'), // comma-separated track IDs for cycle continuity
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  seqIdx: uniqueIndex('radio_queue_seq_idx').on(table.seq),
  startsAtIdx: index('radio_queue_starts_at_idx').on(table.startsAt),
  endsAtIdx: index('radio_queue_ends_at_idx').on(table.endsAt),
  slotKeyIdx: index('radio_queue_slot_key_idx').on(table.slotKey),
}));

// Track Likes
export const trackLikes = pgTable('track_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('track_likes_unique_idx').on(table.trackId, table.userId),
  trackIdx: index('track_likes_track_idx').on(table.trackId),
  userIdx: index('track_likes_user_idx').on(table.userId),
}));

// Submissions (public song submissions)
export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistName: varchar('artist_name', { length: 100 }).notNull(),
  artistEmail: varchar('artist_email', { length: 255 }).notNull(),
  trackTitle: varchar('track_title', { length: 200 }).notNull(),
  trackGenre: trackGenreEnum('track_genre').default('Otros').notNull(),
  trackLanguage: trackLanguageEnum('track_language').default('Español').notNull(),
  audioUrl: varchar('audio_url', { length: 500 }).notNull(),
  coverUrl: varchar('cover_url', { length: 500 }),
  description: text('description'),
  status: submissionStatusEnum('status').default('pending').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdTrackId: uuid('created_track_id').references(() => tracks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('submissions_status_idx').on(table.status),
  artistEmailIdx: index('submissions_artist_email_idx').on(table.artistEmail),
}));

// Pending Submissions (claimed by artists)
export const pendingSubmissions = pgTable('pending_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }).notNull(),
  artistId: uuid('artist_id').references(() => artists.id, { onDelete: 'cascade' }).notNull(),
  claimToken: varchar('claim_token', { length: 64 }).notNull().unique(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  submissionIdx: uniqueIndex('pending_submissions_submission_idx').on(table.submissionId),
  artistIdx: index('pending_submissions_artist_idx').on(table.artistId),
}));

// Articles (news/blog)
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 220 }).notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  coverUrl: varchar('cover_url', { length: 500 }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  status: articleStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('articles_slug_idx').on(table.slug),
  statusIdx: index('articles_status_idx').on(table.status),
  publishedAtIdx: index('articles_published_at_idx').on(table.publishedAt),
}));

// Suggestions (user feedback)
export const suggestions = pgTable('suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  category: varchar('category', { length: 50 }),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('new').notNull(), // new, read, replied
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Contact Messages
export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('new').notNull(), // new, read, replied
  repliedBy: uuid('replied_by').references(() => users.id, { onDelete: 'set null' }),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Listen Events (analytics)
export const listenEvents = pgTable('listen_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  eventType: varchar('event_type', { length: 20 }).notNull(), // play, pause, end, skip, error
  positionMs: integer('position_ms'),
  durationMs: integer('duration_ms'),
  userAgent: text('user_agent'),
  ipHash: varchar('ip_hash', { length: 64 }), // hashed for privacy
  country: varchar('country', { length: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  trackIdx: index('listen_events_track_idx').on(table.trackId),
  sessionIdx: index('listen_events_session_idx').on(table.sessionId),
  eventTypeIdx: index('listen_events_type_idx').on(table.eventType),
  createdAtIdx: index('listen_events_created_at_idx').on(table.createdAt),
}));

// Genre Options (dynamic genres added by artists)
export const genreOptions = pgTable('genre_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
  trackCount: integer('track_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Marketing Contacts
export const marketingContacts = pgTable('marketing_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  source: varchar('source', { length: 50 }), // subscription, submission, contact, etc.
  subscribed: boolean('subscribed').default(true).notNull(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('marketing_contacts_email_idx').on(table.email),
}));

// Prospects (promotion leads)
export const prospects = pgTable('prospects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  artistName: varchar('artist_name', { length: 100 }),
  message: text('message'),
  status: varchar('status', { length: 20 }).default('new').notNull(), // new, contacted, converted
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('prospects_email_idx').on(table.email),
  statusIdx: index('prospects_status_idx').on(table.status),
}));

// Top Week (weekly chart)
export const topWeek = pgTable('top_week', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'cascade' }).notNull(),
  weekStart: timestamp('week_start', { withTimezone: true }).notNull(),
  position: integer('position').notNull(),
  likesSnapshot: integer('likes_snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('top_week_unique_idx').on(table.trackId, table.weekStart),
  weekIdx: index('top_week_week_idx').on(table.weekStart),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  artist: one(artists, { fields: [users.id], references: [artists.userId] }),
  trackLikes: many(trackLikes),
  authoredArticles: many(articles),
  contactReplies: many(contactMessages),
  submissionsReviewed: many(submissions),
  marketingContacts: many(marketingContacts),
}));

export const artistsRelations = relations(artists, ({ one, many }) => ({
  user: one(users, { fields: [artists.userId], references: [users.id] }),
  tracks: many(tracks),
  pendingClaims: many(pendingSubmissions),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  artist: one(artists, { fields: [tracks.artistId], references: [artists.id] }),
  likes: many(trackLikes),
  radioQueueEntries: many(radioQueue),
  submissions: many(submissions),
  listenEvents: many(listenEvents),
  topWeekEntries: many(topWeek),
}));

export const programsRelations = relations(programs, ({}) => ({}));

export const radioQueueRelations = relations(radioQueue, ({ one }) => ({
  track: one(tracks, { fields: [radioQueue.trackId], references: [tracks.id] }),
}));

export const trackLikesRelations = relations(trackLikes, ({ one }) => ({
  track: one(tracks, { fields: [trackLikes.trackId], references: [tracks.id] }),
  user: one(users, { fields: [trackLikes.userId], references: [users.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  reviewer: one(users, { fields: [submissions.reviewedBy], references: [users.id] }),
  createdTrack: one(tracks, { fields: [submissions.createdTrackId], references: [tracks.id] }),
  pendingClaim: one(pendingSubmissions, { fields: [submissions.id], references: [pendingSubmissions.submissionId] }),
}));

export const pendingSubmissionsRelations = relations(pendingSubmissions, ({ one }) => ({
  submission: one(submissions, { fields: [pendingSubmissions.submissionId], references: [submissions.id] }),
  artist: one(artists, { fields: [pendingSubmissions.artistId], references: [artists.id] }),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(users, { fields: [articles.authorId], references: [users.id] }),
}));

export const suggestionsRelations = relations(suggestions, ({ one }) => ({
  user: one(users, { fields: [suggestions.userId], references: [users.id] }),
}));

export const contactMessagesRelations = relations(contactMessages, ({ one }) => ({
  replier: one(users, { fields: [contactMessages.repliedBy], references: [users.id] }),
}));

export const listenEventsRelations = relations(listenEvents, ({ one }) => ({
  track: one(tracks, { fields: [listenEvents.trackId], references: [tracks.id] }),
  user: one(users, { fields: [listenEvents.userId], references: [users.id] }),
}));

export const genreOptionsRelations = relations(genreOptions, ({ one }) => ({
  addedByUser: one(users, { fields: [genreOptions.addedBy], references: [users.id] }),
}));

export const marketingContactsRelations = relations(marketingContacts, ({ one }) => ({
  addedBy: one(users, { fields: [marketingContacts.id], references: [users.id] }), // no direct link
}));

export const prospectsRelations = relations(prospects, ({}) => ({}));

export const topWeekRelations = relations(topWeek, ({ one }) => ({
  track: one(tracks, { fields: [topWeek.trackId], references: [tracks.id] }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type RadioQueueEntry = typeof radioQueue.$inferSelect;
export type NewRadioQueueEntry = typeof radioQueue.$inferInsert;
export type TrackLike = typeof trackLikes.$inferSelect;
export type NewTrackLike = typeof trackLikes.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type PendingSubmission = typeof pendingSubmissions.$inferSelect;
export type NewPendingSubmission = typeof pendingSubmissions.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Suggestion = typeof suggestions.$inferSelect;
export type NewSuggestion = typeof suggestions.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type ListenEvent = typeof listenEvents.$inferSelect;
export type NewListenEvent = typeof listenEvents.$inferInsert;
export type GenreOption = typeof genreOptions.$inferSelect;
export type NewGenreOption = typeof genreOptions.$inferInsert;
export type MarketingContact = typeof marketingContacts.$inferSelect;
export type NewMarketingContact = typeof marketingContacts.$inferInsert;
export type Prospect = typeof prospects.$inferSelect;
export type NewProspect = typeof prospects.$inferInsert;
export type TopWeek = typeof topWeek.$inferSelect;
export type NewTopWeek = typeof topWeek.$inferInsert;