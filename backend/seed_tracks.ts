import postgres from 'postgres';

const sql = postgres('postgresql://sonoriafm:sonoriafm_dev_password@localhost:5432/sonoriafm');

async function seed() {
  console.log('🌱 Seeding tracks...');

  // Create artist first
  const [artist] = await sql`
    INSERT INTO artists (name, bio, likes, is_verified)
    VALUES ('DJ Test IA', 'Artista de prueba para SonoriaFM', 100, true)
    RETURNING id
  `;
  console.log('Created artist:', artist);

  // Sample tracks with real audio URLs (using free test audio)
  const tracks = [
    {
      artist_id: artist.id,
      title: 'Electronic Dreams',
      cover_url: 'https://picsum.photos/seed/electronic1/400/400',
      genre: 'electrónica',
      duration: '4:30',
      duration_seconds: 270,
      year: 2024,
      album: 'IA Beats Vol.1',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      likes: 42,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Latin Fire',
      cover_url: 'https://picsum.photos/seed/latin1/400/400',
      genre: 'pop latino',
      duration: '3:45',
      duration_seconds: 225,
      year: 2024,
      album: 'IA Beats Vol.1',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      likes: 38,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Rock Anthem',
      cover_url: 'https://picsum.photos/seed/rock1/400/400',
      genre: 'pop rock',
      duration: '5:00',
      duration_seconds: 300,
      year: 2024,
      album: 'IA Beats Vol.1',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      likes: 55,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Balada Nocturna',
      cover_url: 'https://picsum.photos/seed/balada1/400/400',
      genre: 'baladas',
      duration: '4:15',
      duration_seconds: 255,
      year: 2024,
      album: 'IA Beats Vol.1',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      likes: 28,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Reggaeton IA',
      cover_url: 'https://picsum.photos/seed/reggaeton1/400/400',
      genre: 'urbano/reguetón',
      duration: '3:30',
      duration_seconds: 210,
      year: 2024,
      album: 'IA Beats Vol.1',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      likes: 67,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Electronic Sunrise',
      cover_url: 'https://picsum.photos/seed/electronic2/400/400',
      genre: 'electrónica',
      duration: '4:20',
      duration_seconds: 260,
      year: 2024,
      album: 'IA Beats Vol.2',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      likes: 45,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Pop Latino Dreams',
      cover_url: 'https://picsum.photos/seed/poplatino1/400/400',
      genre: 'pop latino',
      duration: '3:55',
      duration_seconds: 235,
      year: 2024,
      album: 'IA Beats Vol.2',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
      likes: 52,
      language: 'Español',
    },
    {
      artist_id: artist.id,
      title: 'Rock Ballad',
      cover_url: 'https://picsum.photos/seed/rockballad1/400/400',
      genre: 'pop rock',
      duration: '4:40',
      duration_seconds: 280,
      year: 2024,
      album: 'IA Beats Vol.2',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      likes: 33,
      language: 'Español',
    },
  ];

  for (const track of tracks) {
    await sql`
      INSERT INTO tracks (artist_id, title, cover_url, genre, duration, duration_seconds, year, album, audio_url, likes, language)
      VALUES (${track.artist_id}, ${track.title}, ${track.cover_url}, ${track.genre}, ${track.duration}, ${track.duration_seconds}, ${track.year}, ${track.album}, ${track.audio_url}, ${track.likes}, ${track.language})
    `;
    console.log('Created track:', track.title);
  }

  console.log('✅ Seeding complete!');
  await sql.end();
}

seed().catch(console.error);