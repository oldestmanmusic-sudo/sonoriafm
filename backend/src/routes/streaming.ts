import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { tracks, artists } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { HLSGenerator, LiquidsoapGenerator, IcecastConfigGenerator, type HLSConfig } from '../services/streaming.ts';
import { type Track } from '../services/radio-scheduler.ts';

const streamingRoute = new Hono<any>();

// Streaming configuration from env
function getHLSConfig(): HLSConfig {
  return {
    icecastHost: Deno.env.get('ICECAST_HOST') || 'localhost',
    icecastPort: parseInt(Deno.env.get('ICECAST_PORT') || '8000'),
    icecastMount: Deno.env.get('ICECAST_MOUNT') || 'sonoriafm',
    icecastUser: Deno.env.get('ICECAST_USER') || 'source',
    icecastPassword: Deno.env.get('ICECAST_PASSWORD') || 'hackme',
    segmentDuration: parseInt(Deno.env.get('HLS_SEGMENT_DURATION') || '10'),
    playlistWindow: parseInt(Deno.env.get('HLS_PLAYLIST_WINDOW') || '12'),
    outputBitrates: (Deno.env.get('HLS_BITRATES') || '64,128,256').split(',').map(Number),
  };
}

// Initialize HLS generator lazily
let hlsGenerator: HLSGenerator | null = null;

async function getHLSGenerator(): Promise<HLSGenerator> {
  if (!hlsGenerator) {
    // Fetch tracks for scheduler
    const rows = await db.select({
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
      .orderBy(desc(tracks.createdAt));

    const schedulerTracks: Track[] = rows.map(t => ({
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
    })).filter(t => t.audio_url);

    hlsGenerator = new HLSGenerator(getHLSConfig(), schedulerTracks);
  }
  return hlsGenerator;
}

// GET /stream/playlist.m3u8 - Master HLS playlist
streamingRoute.get('/playlist.m3u8', async (c) => {
  try {
    const baseUrl = `${c.req.url.split('/stream/')[0]}/stream`;
    const generator = await getHLSGenerator();
    const playlist = generator.generateMasterPlaylist(baseUrl);

    return c.body(playlist, 200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Error generating master playlist:', error);
    return c.json({ error: 'Failed to generate playlist' }, 500);
  }
});

// GET /stream/:bitrate/playlist.m3u8 - Media playlist for specific bitrate
streamingRoute.get('/:bitrate/playlist.m3u8', async (c) => {
  try {
    const bitrate = parseInt(c.req.param('bitrate').replace('k', ''));
    const baseUrl = `${c.req.url.split(`/${c.req.param('bitrate')}`)[0]}/stream/${c.req.param('bitrate')}`;
    const generator = await getHLSGenerator();
    const playlist = generator.generateMediaPlaylist(bitrate, baseUrl);

    return c.body(playlist, 200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Error generating media playlist:', error);
    return c.json({ error: 'Failed to generate playlist' }, 500);
  }
});

// GET /stream/:bitrate/segment-:seq-:index.ts - HLS segment
streamingRoute.get('/:bitrate/segment-:seq-:index.ts', async (c) => {
  try {
    const bitrate = parseInt(c.req.param('bitrate').replace('k', ''));
    const seq = parseInt(c.req.param('seq'));
    const index = parseInt(c.req.param('index'));

    // In production: transcode and serve actual segment
    // For now, return dummy TS packet
    const generator = await getHLSGenerator();

    // Find the entry in the queue
    const config = getHLSConfig();
    const rows = await db.select().from(tracks).orderBy(desc(tracks.createdAt));
    const schedulerTracks: Track[] = rows.map(t => ({
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
    })).filter(t => t.audio_url);

    const tempScheduler = new (await import('../services/radio-scheduler.ts')).RadioScheduler(schedulerTracks);
    const { entries } = tempScheduler.generateFullQueue(Date.now());
    const entry = entries.find(e => e.seq === seq);

    if (!entry) {
      return c.json({ error: 'Segment not found' }, 404);
    }

    const segment = await generator.generateSegment(entry, bitrate, index);

    return c.body(segment, 200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Error generating segment:', error);
    return c.json({ error: 'Failed to generate segment' }, 500);
  }
});

// GET /stream/endpoints - Get streaming endpoints for frontend
streamingRoute.get('/endpoints', async (c) => {
  try {
    const baseUrl = c.req.url.split('/stream/')[0];
    const generator = await getHLSGenerator();
    const endpoints = generator.getEndpoints(baseUrl);

    return c.json(endpoints);
  } catch (error) {
    console.error('Error getting endpoints:', error);
    return c.json({ error: 'Failed to get endpoints' }, 500);
  }
});

// GET /stream/config/liquidsoap - Generate liquidsoap script (admin)
streamingRoute.get('/config/liquidsoap', async (c) => {
  try {
    const config = getHLSConfig();
    const generator = new LiquidsoapGenerator(config);
    const script = generator.generateScript();

    return c.body(script, 200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Error generating liquidsoap script:', error);
    return c.json({ error: 'Failed to generate script' }, 500);
  }
});

// GET /stream/config/liquidsoap.service - Generate systemd service (admin)
streamingRoute.get('/config/liquidsoap.service', async (c) => {
  try {
    const config = getHLSConfig();
    const generator = new LiquidsoapGenerator(config);
    const service = generator.generateSystemdService();

    return c.body(service, 200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Error generating systemd service:', error);
    return c.json({ error: 'Failed to generate service' }, 500);
  }
});

// GET /stream/config/icecast.xml - Generate icecast config (admin)
streamingRoute.get('/config/icecast.xml', async (c) => {
  try {
    const config = getHLSConfig();
    const generator = new IcecastConfigGenerator(config);
    const xml = generator.generateConfig();

    return c.body(xml, 200, {
      'Content-Type': 'application/xml',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Error generating icecast config:', error);
    return c.json({ error: 'Failed to generate config' }, 500);
  }
});

// POST /stream/reload - Reload tracks in HLS generator (admin)
streamingRoute.post('/reload', async (c) => {
  try {
    hlsGenerator = null; // Force reinitialization
    await getHLSGenerator();
    return c.json({ success: true, message: 'HLS generator reloaded' });
  } catch (error) {
    console.error('Error reloading HLS generator:', error);
    return c.json({ error: 'Failed to reload' }, 500);
  }
});

export default streamingRoute;