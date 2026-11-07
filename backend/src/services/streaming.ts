/**
 * Streaming Service - HLS/Icecast Integration
 * Generates HLS playlists from radio queue - does NOT affect radio automation logic
 * Radio automation continues to work as-is; this just provides streaming endpoints
 */

import { RadioScheduler, type Track } from './radio-scheduler.ts';

export interface HLSConfig {
  icecastHost: string;
  icecastPort: number;
  icecastMount: string;
  icecastUser: string;
  icecastPassword: string;
  segmentDuration: number; // seconds
  playlistWindow: number; // number of segments to keep
  outputBitrates: number[]; // kbps
}

export interface StreamEndpoints {
  hls: string;        // Master playlist URL
  dash: string;       // DASH manifest URL (optional)
  icecast: string;    // Direct Icecast mount URL
}

/**
 * HLS Generator - Creates HLS playlists from radio queue
 * This is a passive service - it reads from radioQueue and generates playlists
 * Does NOT modify the radio automation logic
 */
export class HLSGenerator {
  private config: HLSConfig;
  private scheduler: RadioScheduler;
  private segmentCache: Map<string, Uint8Array> = new Map();

  constructor(config: HLSConfig, tracks: Track[]) {
    this.config = config;
    this.scheduler = new RadioScheduler(tracks);
  }

  updateTracks(tracks: Track[]) {
    this.scheduler = new RadioScheduler(tracks);
  }

  /**
   * Generate master HLS playlist (.m3u8)
   * Returns URLs for different bitrates
   */
  generateMasterPlaylist(baseUrl: string): string {
    const bitrates = this.config.outputBitrates;
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:6\n\n';

    for (const bitrate of bitrates) {
      const bandwidth = bitrate * 1000;
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${Math.floor(bandwidth * 0.9)},CODECS="mp4a.40.2"\n`;
      playlist += `${baseUrl}/stream/${bitrate}k/playlist.m3u8\n\n`;
    }

    return playlist;
  }

  /**
   * Generate media playlist for a specific bitrate
   * Contains segment URLs and timing info
   */
  generateMediaPlaylist(bitrate: number, baseUrl: string, nowMs: number = Date.now()): string {
    const { entries } = this.scheduler.generateFullQueue(nowMs);
    const segmentDuration = this.config.segmentDuration;
    const windowSize = this.config.playlistWindow;

    // Take upcoming entries that fit in the window
    const relevantEntries = entries
      .filter(e => e.startsAt <= nowMs + windowSize * segmentDuration * 1000)
      .slice(0, windowSize);

    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:6\n';
    playlist += `#EXT-X-TARGETDURATION:${segmentDuration}\n`;
    playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
    playlist += '#EXT-X-PLAYLIST-TYPE:EVENT\n\n';

    for (const entry of relevantEntries) {
      const duration = entry.durationMs / 1000;
      const segments = Math.ceil(duration / segmentDuration);

      for (let i = 0; i < segments; i++) {
        const segDuration = i === segments - 1
          ? duration - (segments - 1) * segmentDuration
          : segmentDuration;

        playlist += `#EXTINF:${segDuration.toFixed(3)},\n`;
        playlist += `${baseUrl}/stream/${bitrate}k/segment-${entry.seq}-${i}.ts\n`;
      }
    }

    return playlist;
  }

  /**
   * Generate segment data (placeholder - in production, this would transcode)
   * Returns dummy MPEG-TS segment for testing
   */
  async generateSegment(entry: any, bitrate: number, segmentIndex: number): Promise<Uint8Array> {
    // In production: transcode entry.audio_url to MPEG-TS at specified bitrate
    // Using ffmpeg or Liquidsoap
    // For now, return minimal valid MPEG-TS packet
    return this.createDummyTSPacket();
  }

  private createDummyTSPacket(): Uint8Array {
    // Minimal MPEG-TS packet (188 bytes) with PAT/PMT
    const packet = new Uint8Array(188);
    packet[0] = 0x47; // Sync byte
    packet[1] = 0x40; // Payload unit start + PID 0 (PAT)
    packet[2] = 0x00;
    packet[3] = 0x10; // No adaptation field, continuity counter 0
    // PAT table would go here
    return packet;
  }

  /**
   * Get stream endpoints for frontend
   */
  getEndpoints(baseUrl: string): StreamEndpoints {
    return {
      hls: `${baseUrl}/stream/playlist.m3u8`,
      icecast: `http://${this.config.icecastHost}:${this.config.icecastPort}/${this.config.icecastMount}`,
      dash: `${baseUrl}/stream/manifest.mpd`,
    };
  }
}

/**
 * Liquidsoap Script Generator
 * Generates liquidsoap script for Icecast streaming
 * This runs SEPARATELY from the main backend - it's a streaming engine
 */
export class LiquidsoapGenerator {
  private config: HLSConfig;

  constructor(config: HLSConfig) {
    this.config = config;
  }

  /**
   * Generate liquidsoap script for 24/7 streaming
   * Reads from HTTP endpoint (our /radio/now) and streams to Icecast
   */
  generateScript(): string {
    return `
# Liquidsoap script for SonoriaFM 24/7 streaming
# Generated automatically - do not edit manually

# Configuration
set("server.telnet", true)
set("server.telnet.port", 1234)
set("log.file.path", "/var/log/liquidsoap/sonoriafm.log")
set("log.level", 3)

# Icecast output
output.icecast(
  %mp3(bitrate=128, samplerate=44100, stereo=true),
  host="${this.config.icecastHost}",
  port=${this.config.icecastPort},
  password="${this.config.icecastPassword}",
  user="${this.config.icecastUser}",
  mount="${this.config.icecastMount}",
  name="SonoriaFM",
  description="Radio de música hecha con IA 24/7",
  genre="Various",
  url="https://sonoria.com",
  public=true,
  stream
)

# HLS output for adaptive bitrate
output.icecast(
  %mp3(bitrate=64, samplerate=44100, stereo=true),
  host="${this.config.icecastHost}",
  port=${this.config.icecastPort},
  password="${this.config.icecastPassword}",
  user="${this.config.icecastUser}",
  mount="${this.config.icecastMount}_64k",
  stream
)

output.icecast(
  %mp3(bitrate=256, samplerate=44100, stereo=true),
  host="${this.config.icecastHost}",
  port=${this.config.icecastPort},
  password="${this.config.icecastPassword}",
  user="${this.config.icecastUser}",
  mount="${this.config.icecastMount}_256k",
  stream
)

# Main stream source - fetches from our API
def fetch_track() =
  # Request next track from our radio/now endpoint
  let response = http.get("http://backend:8000/api/radio/now?count=1") in
  let data = json.parse(response) in
  let track = data.tracks[0] in
  # Return track info and audio URL
  (track.audio_url, track.title, track.artist)
end

# Stream generator
stream = request.dynamic(
  { "timeout": 30.0 },
  fetch_track
)

# Fallback in case of errors
fallback = single("file:///opt/sonoriafm/fallback.mp3")

# Main output with fallback
stream = fallback(track_sensitive=false, stream)

# Register telnet commands for monitoring
server.register(
  namespace="sonoriafm",
  description="SonoriaFM streaming commands",
  [
    ("status", fun () -> "Streaming active"),
    ("next", fun () -> "Next track scheduled"),
  ]
)
`.trim();
  }

  /**
   * Generate systemd service file for liquidsoap
   */
  generateSystemdService(): string {
    return `
[Unit]
Description=SonoriaFM Liquidsoap Streamer
After=network.target icecast2.service
Requires=icecast2.service

[Service]
Type=simple
User=liquidsoap
Group=liquidsoap
ExecStart=/usr/bin/liquidsoap /opt/sonoriafm/stream.liq
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource limits
MemoryLimit=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
`.trim();
  }
}

/**
 * Icecast Configuration Generator
 */
export class IcecastConfigGenerator {
  private config: HLSConfig;

  constructor(config: HLSConfig) {
    this.config = config;
  }

  generateConfig(): string {
    return `
<icecast>
  <location>Madrid, Spain</location>
  <admin>admin@sonoriafm.com</admin>
  <hostname>${this.config.icecastHost}</hostname>

  <limits>
    <clients>1000</clients>
    <sources>10</sources>
    <threadpool>4</threadpool>
    <queue-size>524288</queue-size>
    <client-timeout>30</client-timeout>
    <header-timeout>15</header-timeout>
    <source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect>
    <burst-size>65535</burst-size>
  </limits>

  <authentication>
    <source-password>${this.config.icecastPassword}</source-password>
    <relay-password>${this.config.icecastPassword}</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>${this.config.icecastPassword}</admin-password>
  </authentication>

  <directory>
    <yp-url-timeout>15</yp-url-timeout>
    <yp-url>http://dir.xiph.org/cgi-bin/yp-cgi</yp-url>
  </directory>

  <listen-socket>
    <port>${this.config.icecastPort}</port>
    <bind-address>0.0.0.0</bind-address>
  </listen-socket>

  <http-headers>
    <header name="Access-Control-Allow-Origin" value="*" />
    <header name="Access-Control-Allow-Headers" value="Origin, X-Requested-With, Content-Type, Accept" />
    <header name="Access-Control-Allow-Methods" value="GET, OPTIONS, HEAD" />
  </http-headers>

  <mount>
    <mount-name>/${this.config.icecastMount}</mount-name>
    <username>${this.config.icecastUser}</username>
    <password>${this.config.icecastPassword}</password>
    <max-listeners>500</max-listeners>
    <burst-size>65535</burst-size>
    <hidden>0</hidden>
    <public>1</public>
    <stream-name>SonoriaFM - Radio de música IA 24/7</stream-name>
    <stream-description>La radio de la música hecha con IA. Artistas de todo el mundo.</stream-description>
    <stream-url>https://sonoria.com</stream-url>
    <genre>Various</genre>
    <bitrate>128</bitrate>
    <type>audio/mpeg</type>
    <subtype>mp3</subtype>
  </mount>

  <mount>
    <mount-name>/${this.config.icecastMount}_64k</mount-name>
    <username>${this.config.icecastUser}</username>
    <password>${this.config.icecastPassword}</password>
    <max-listeners>200</max-listeners>
    <bitrate>64</bitrate>
  </mount>

  <mount>
    <mount-name>/${this.config.icecastMount}_256k</mount-name>
    <username>${this.config.icecastUser}</username>
    <password>${this.config.icecastPassword}</password>
    <max-listeners>200</max-listeners>
    <bitrate>256</bitrate>
  </mount>

  <fileserve>1</fileserve>
  <paths>
    <logdir>/var/log/icecast2</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
    <alias source="/" destination="/status.xsl"/>
  </paths>

  <logging>
    <accesslog>access.log</accesslog>
    <errorlog>error.log</errorlog>
    <loglevel>3</loglevel>
    <logsize>10000</logsize>
    <logarchive>0</logarchive>
  </logging>

  <security>
    <chroot>0</chroot>
    <changeowner>
      <user>icecast2</user>
      <group>icecast2</group>
    </changeowner>
  </security>
</icecast>
`.trim();
  }
}

export { HLSConfig, StreamEndpoints };