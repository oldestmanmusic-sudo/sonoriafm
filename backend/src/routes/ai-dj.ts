import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { tracks, artists } from '../db/schema.ts';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import { AIDJ, DJManager, DJPersona, DJContext, Track } from '../services/ai-dj.ts';
import { RadioScheduler } from '../services/radio-scheduler.ts';

const aiDjRoute = new Hono();

// Schema for DJ generation request
const generateDjSchema = z.object({
  persona: z.enum(['profesional', 'amigo', 'energia', 'relajado', 'experto']).default('profesional'),
  slotName: z.string().optional(),
  hoursAhead: z.number().int().positive().max(24).default(2),
  ttsProvider: z.enum(['browser', 'elevenlabs', 'azure', 'google']).default('browser'),
  generateAudio: z.boolean().default(false),
  llmConfig: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama', 'local', 'mock']).optional(),
    model: z.string().optional(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }).optional(),
});

// POST /ai-dj/generate - Generate DJ announcements for upcoming schedule
aiDjRoute.post('/generate', zValidator('json', generateDjSchema), async (c) => {
  try {
    const { persona, slotName, hoursAhead, ttsProvider, generateAudio, llmConfig } = c.req.valid('json');

    // Fetch upcoming tracks from radio scheduler
    const allTracks = await db.select({
      id: tracks.id,
      title: tracks.title,
      artistId: tracks.artistId,
      artistName: artists.name,
      coverUrl: tracks.coverUrl,
      genre: tracks.genre,
      duration: tracks.duration,
      durationSeconds: tracks.durationSeconds,
      audioUrl: tracks.audioUrl,
      likes: tracks.likes,
      language: tracks.language,
      createdAt: tracks.createdAt,
    })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      .orderBy(desc(tracks.createdAt))
      .limit(200);

    const schedulerTracks: Track[] = allTracks
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artistName || 'Unknown Artist',
        cover_url: t.coverUrl || undefined,
        genre: t.genre,
        duration: t.duration || undefined,
        durationSeconds: t.durationSeconds || undefined,
        audio_url: t.audioUrl,
        likes: t.likes,
        language: t.language,
        created_date: t.createdAt.toISOString(),
      }))
      .filter(t => t.audio_url);

    if (schedulerTracks.length === 0) {
      return c.json({ error: 'No tracks available for scheduling' }, 404);
    }

    // Generate schedule for next N hours
    const scheduler = new RadioScheduler(schedulerTracks);
    const now = Date.now();
    const { entries } = scheduler.generateFullQueue(now);
    const upcomingEntries = entries
      .filter(e => e.startsAt <= now + hoursAhead * 3600 * 1000)
      .slice(0, 30); // Limit to 30 tracks

    // Determine current slot
    const { slotKey } = (await import('../services/radio-constants.ts')).slotAt(now);
    const slotNames: Record<number, string> = {
      0: 'Club Electrónico',
      1: 'Pop Rock',
      2: 'Latino Total (tarde)',
      3: 'Música en otros idiomas',
      4: 'Top Sonoria',
      5: 'Baladas',
      7: 'Latino Total (madrugada)'
    };
    const currentSlotName = slotName || slotNames[slotKey % 10] || 'Programación';

    // Build DJ context
    const djContext: DJContext = {
      timeOfDay: getTimeOfDay(now),
      slotName: currentSlotName,
      isFirstSong: true,
      isLastSongInSlot: false
    };

    // Convert entries to tracks for DJ
    const upcomingTracks: Track[] = upcomingEntries.map(e => ({
      id: e.track_id,
      title: e.title,
      artist: e.artist,
      cover_url: e.cover_url,
      genre: e.genre,
      duration: e.duration,
      audio_url: e.audio_url,
      likes: 0,
      language: e.language,
      created_date: new Date(e.startsAt).toISOString()
    }));

    // Create DJ Manager with requested persona and LLM config
    const djManager = new DJManager(persona, 'browser');
    if (llmConfig) {
      djManager.setLLMConfig(llmConfig);
    }
    await djManager.generateAndQueueAnnouncements(upcomingTracks, djContext);

    // Get generated announcements
    const announcements = (djManager as any).announcementQueue || [];

    // Generate audio if requested (only for browser TTS)
    let audioAnnouncements = [];
    if (generateAudio && ttsProvider === 'browser') {
      for (const ann of announcements.slice(0, 5)) { // Limit to first 5
        try {
          const audioUrl = await generateBrowserTTS(ann.text);
          audioAnnouncements.push({
            ...ann,
            audioUrl
          });
        } catch (err) {
          console.error('TTS error:', err);
          audioAnnouncements.push(ann);
        }
      }
    }

    return c.json({
      success: true,
      slotName: currentSlotName,
      timeOfDay: djContext.timeOfDay,
      tracksCount: upcomingTracks.length,
      announcements: audioAnnouncements.length > 0 ? audioAnnouncements : announcements,
      nextTracks: upcomingTracks.slice(0, 5).map(t => ({
        title: t.title,
        artist: t.artist,
        duration: t.duration
      }))
    });
  } catch (error) {
    console.error('AI DJ generation error:', error);
    return c.json({ error: 'Failed to generate DJ announcements' }, 500);
  }
});

// GET /ai-dj/preview - Quick preview of DJ announcements for next few tracks
aiDjRoute.get('/preview', async (c) => {
  try {
    const persona = c.req.query('persona') as DJPersona || 'profesional';
    const hoursAhead = parseInt(c.req.query('hoursAhead') || '1');

    const allTracks = await db.select({
      id: tracks.id,
      title: tracks.title,
      artistId: tracks.artistId,
      artistName: artists.name,
      coverUrl: tracks.coverUrl,
      genre: tracks.genre,
      duration: tracks.duration,
      durationSeconds: tracks.durationSeconds,
      audioUrl: tracks.audioUrl,
      likes: tracks.likes,
      language: tracks.language,
      createdAt: tracks.createdAt,
    })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      .orderBy(desc(tracks.createdAt))
      .limit(100);

    const schedulerTracks: Track[] = allTracks
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artistName || 'Unknown Artist',
        cover_url: t.coverUrl || undefined,
        genre: t.genre,
        duration: t.duration || undefined,
        durationSeconds: t.durationSeconds || undefined,
        audio_url: t.audioUrl,
        likes: t.likes,
        language: t.language,
        created_date: t.createdAt.toISOString(),
      }))
      .filter(t => t.audio_url);

    if (schedulerTracks.length === 0) {
      return c.json({ error: 'No tracks available' }, 404);
    }

    const scheduler = new RadioScheduler(schedulerTracks);
    const now = Date.now();
    const { entries } = scheduler.generateFullQueue(now);
    const upcomingEntries = entries.filter(e => e.startsAt <= now + hoursAhead * 3600 * 1000).slice(0, 10);

    const { slotKey } = (await import('../services/radio-constants.ts')).slotAt(now);
    const slotNames: Record<number, string> = {
      0: 'Club Electrónico',
      1: 'Pop Rock',
      2: 'Latino Total (tarde)',
      3: 'Música en otros idiomas',
      4: 'Top Sonoria',
      5: 'Baladas',
      7: 'Latino Total (madrugada)'
    };

    const upcomingTracks: Track[] = upcomingEntries.map(e => ({
      id: e.track_id,
      title: e.title,
      artist: e.artist,
      cover_url: e.cover_url,
      genre: e.genre,
      duration: e.duration,
      audio_url: e.audio_url,
      likes: 0,
      language: e.language,
      created_date: new Date(e.startsAt).toISOString()
    }));

    const djManager = new DJManager('profesional', 'browser');
    const djContext: DJContext = {
      timeOfDay: getTimeOfDay(now),
      slotName: slotNames[slotKey % 10] || 'Programación',
      isFirstSong: true,
      isLastSongInSlot: false
    };

    await djManager.generateAndQueueAnnouncements(upcomingTracks, djContext);
    const announcements = (djManager as any).announcementQueue || [];

    return c.json({
      success: true,
      persona,
      slotName: slotNames[slotKey % 10] || 'Programación',
      timeOfDay: getTimeOfDay(now),
      announcements: announcements.slice(0, 10).map(a => ({
        type: a.type,
        text: a.text,
        priority: a.priority,
        durationMs: a.durationMs
      }))
    });
  } catch (error) {
    console.error('DJ preview error:', error);
    return c.json({ error: 'Failed to generate preview' }, 500);
  }
});

// POST /ai-dj/synthesize - Synthesize single text to speech
const synthesizeSchema = z.object({
  text: z.string().min(1).max(500),
  voice: z.string().optional(),
  provider: z.enum(['browser', 'elevenlabs', 'azure', 'google']).default('browser'),
  persona: z.enum(['profesional', 'amigo', 'energia', 'relajado', 'experto']).optional(),
});

aiDjRoute.post('/synthesize', zValidator('json', synthesizeSchema), async (c) => {
  try {
    const { text, voice, provider, persona } = c.req.valid('json');

    let enrichedText = text;

    // Enrich with persona if provided
    if (persona) {
      const dj = new AIDJ(persona);
      enrichedText = await dj['enrichWithPersonality'](text, {
        currentTrack: undefined,
        nextTrack: undefined,
        previousTrack: undefined,
        timeOfDay: 'mañana',
        slotName: 'Test',
        isFirstSong: false,
        isLastSongInSlot: false
      } as any, (await import('../services/ai-dj.ts')).DJ_PERSONAS[persona]);
    }

    const audioUrl = await synthesizeSpeech(enrichedText, voice, provider);

    return c.json({
      success: true,
      text: enrichedText,
      audioUrl,
      provider
    });
  } catch (error) {
    console.error('TTS synthesis error:', error);
    return c.json({ error: 'Failed to synthesize speech' }, 500);
  }
});

// GET /ai-dj/personas - List available DJ personas
aiDjRoute.get('/personas', async (c) => {
  const { DJ_PERSONAS } = await import('../services/ai-dj.ts');
  return c.json({
    personas: Object.entries(DJ_PERSONAS).map(([key, value]) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      style: value.style,
      exampleVocabulary: value.vocabulary.slice(0, 3)
    }))
  });
});

// GET /ai-dj/tts-providers - List available TTS providers
aiDjRoute.get('/tts-providers', async (c) => {
  const { TTS_PROVIDERS } = await import('../services/ai-dj.ts');
  return c.json({
    providers: Object.entries(TTS_PROVIDERS).map(([key, value]) => ({
      id: key,
      name: value.name,
      voices: value.voices.slice(0, 5),
      requiresApiKey: key !== 'browser'
    }))
  });
});

// Helper functions
function getTimeOfDay(timestamp: number): 'madrugada' | 'mañana' | 'mediodia' | 'tarde' | 'noche' {
  const date = new Date(timestamp);
  const hour = date.getHours();
  if (hour >= 0 && hour < 6) return 'madrugada';
  if (hour >= 6 && hour < 12) return 'mañana';
  if (hour >= 12 && hour < 14) return 'mediodia';
  if (hour >= 14 && hour < 20) return 'tarde';
  return 'noche';
}

async function generateBrowserTTS(text: string): Promise<string> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    // We can't actually return audio URL from SpeechSynthesis
    // This is a placeholder - in reality you'd use a TTS API
    resolve(`data:audio/wav;base64,${btoa('placeholder')}`);
  });
}

async function synthesizeSpeech(text: string, voice?: string, provider: string = 'browser'): Promise<string> {
  // This would call actual TTS APIs in production
  // For now, return placeholder
  return `data:audio/wav;base64,${btoa('placeholder')}`;
}

export default aiDjRoute;