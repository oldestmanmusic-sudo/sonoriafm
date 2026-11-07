/**
 * AI DJ System - Locutor inteligente para SonoriaFM
 * Genera locuciones naturales entre canciones usando LLM + TTS
 */

import { Track } from './radio-scheduler.ts';

// LLM Provider types
export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'local' | 'mock';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface DJContext {
  currentTrack?: Track;
  nextTrack?: Track;
  previousTrack?: Track;
  timeOfDay: 'madrugada' | 'mañana' | 'mediodia' | 'tarde' | 'noche';
  slotName: string;
  listenerCount?: number;
  isFirstSong: boolean;
  isLastSongInSlot: boolean;
  specialEvent?: string;
}

export interface DJAnnouncement {
  text: string;
  audioUrl?: string;
  durationMs: number;
  type: 'intro' | 'outro' | 'transition' | 'timecheck' | 'promo' | 'weather' | 'special';
  priority: number; // 1-10, higher = more important
}

export type DJPersona = 'profesional' | 'amigo' | 'energia' | 'relajado' | 'experto';

// Personalidades del DJ
export const DJ_PERSONAS: Record<DJPersona, {
  systemPrompt: string;
  style: string;
  vocabulary: string[];
  avoidWords: string[];
}> = {
  profesional: {
    systemPrompt: `Eres un locutor de radio profesional con 20 años de experiencia. Hablas claro, con buena dicción, usas lenguaje cuidado pero accesible. Das información relevante de forma concisa.`,
    style: 'formal pero cercano',
    vocabulary: ['les presentamos', 'a continuación', 'les recuerda', 'les informamos', 'según nuestro horario'],
    avoidWords: ['guay', 'chulo', 'mola', 'flipante', 'brutal']
  },
  amigo: {
    systemPrompt: `Eres el amigo que pone música en la fiesta. Hablas natural, como si charlaras con colegas. Usas expresiones coloquiales, te ríes, eres cercano y cálido.`,
    style: 'casual y cálido',
    vocabulary: ['oye', 'mira', 'te va a gustar', 'qué tema', 'para ti', 'amigos'],
    avoidWords: ['estimados', 'audiencia', 'radioyentes', 'programación']
  },
  energia: {
    systemPrompt: `Eres el DJ que sube el volumen. Hablas rápido, con entusiasmo contagioso, usas onomatopeyas, gritas un poco, haces que la gente quiera bailar.`,
    style: 'explosivo y motivador',
    vocabulary: ['¡DALE!', '¡ARRIBA!', '¡SUÉLTATE!', '¡VAYA TEMÓN!', '¡NO PARAIS!', '¡VAMOS!'],
    avoidWords: ['tranquilo', 'relajado', 'suave', 'lento', 'pausa']
  },
  relajado: {
    systemPrompt: `Eres el locutor de la madrugada. Voz baja, pausada, susurrante casi. Haces sentir compañía en la soledad nocturna. Poético pero sin empalagar.`,
    style: 'íntimo y nocturno',
    vocabulary: ['susurra', 'la noche', 'compañeros de insomnio', 'bajo las sábanas', 'luz de luna'],
    avoidWords: ['fiesta', 'baila', 'subidón', 'energia', 'vamos']
  },
  experto: {
    systemPrompt: `Eres el crítico musical que sabe de todo. Das datos: año, productor, sample, anécdota del estudio, influencia. Enseñas mientras entretienes.`,
    style: 'culto y curioso',
    vocabulary: ['producido por', 'sample de', 'grabado en', 'curiosamente', 'influenciado por', 'el dato'],
    avoidWords: ['guay', 'mola', 'flipante', 'normal', 'común']
  }
};

// Plantillas de locución por tipo
export const DJ_TEMPLATES = {
  intro: [
    // Primera canción del slot
    'Bienvenidos a {slotName}. Son las {time} y empezamos con {artist} y "{title}".',
    'Arranca {slotName} en Sonoria FM. Son las {time} y la primera es {artist} con "{title}".',
    'Buenos días/noches. Son las {time} en Madrid y abrimos {slotName} con {artist} y su tema "{title}".',
  ],
  outro: [
    // Última canción del slot
    'Y con {artist} y "{title}" cerramos {slotName}. Seguimos en Sonoria FM.',
    'Ha sido {artist} con "{title}", final de {slotName}. No se vayan, continua la música.',
    'Hasta aquí {slotName}. Os dejo con {nextArtist} en el siguiente bloque.',
  ],
  transition: [
    // Entre canciones normales
    'Era {artist} con "{title}". Ahora {nextArtist} con "{nextTitle}".',
    '{artist} nos deja con "{title}". Seguimos con {nextArtist} y "{nextTitle}".',
    'Sonaba {artist}... y ahora le toca el turno a {nextArtist} con "{nextTitle}".',
    'De {artist} a {nextArtist}. La música no para en Sonoria FM.',
  ],
  timecheck: [
    // Cada hora o media hora
    'Son las {time} en Madrid. Están en Sonoria FM, la radio de la música hecha con IA.',
    'Marcan las {time}. Sonoria FM, música IA 24/7.',
    'Son las {time} exactas. Seguimos con {slotName} en Sonoria FM.',
  ],
  promo: [
    // Promociones internas
    '¿Sabéis que podéis enviar vuestra música IA a Sonoria FM? Visitad sonoria.com/envia-tu-cancion.',
    '¿Eres artista IA? Tu música puede sonar aquí. Envíanos tu tema en sonoria.com.',
    'Apoya a Sonoria FM con una donación en sonoria.com/donar. La radio de todos.',
  ],
  weather: [
    // Tiempo (si se integra API)
    'En Madrid hace {temp} grados y {condition}. Perfecto para {slotName}.',
    'El tiempo en Madrid: {temp}º y {condition}. Buena banda sonora para hoy.',
  ],
  special: [
    // Eventos especiales
    '¡Atención! Hoy es {event}. Tenemos programación especial en Sonoria FM.',
    'Es {event} y lo celebramos con la mejor música IA.',
  ]
};

// Generador de locuciones inteligentes
export class AIDJ {
  private persona: DJPersona;
  private customInstructions: string;
  private usedPhrases: Set<string> = new Set();
  private lastAnnouncementTime = 0;

  constructor(persona: DJPersona = 'profesional', customInstructions = '') {
    this.persona = persona;
    this.customInstructions = customInstructions;
  }

  setPersona(persona: DJPersona) {
    this.persona = persona;
  }

  // Generar locución contextual
  async generateAnnouncement(context: DJContext, type: DJAnnouncement['type']): Promise<DJAnnouncement | null> {
    const persona = DJ_PERSONAS[this.persona];
    const templates = DJ_TEMPLATES[type] || [];

    if (templates.length === 0) return null;

    // Seleccionar plantilla no usada recientemente
    let template = this.selectTemplate(templates);
    if (!template) return null;

    // Rellenar plantilla con contexto
    const text = this.fillTemplate(template, context);

    // Enriquecer con personalidad via LLM (opcional)
    const enrichedText = await this.enrichWithPersonality(text, context, persona);

    // Calcular duración estimada (150 palabras/minuto = 2.5 palabras/seg)
    const words = enrichedText.split(' ').length;
    const durationMs = Math.max(2000, (words / 2.5) * 1000);

    this.usedPhrases.add(enrichedText);
    this.lastAnnouncementTime = Date.now();

    return {
      text: enrichedText,
      durationMs,
      type,
      priority: this.getPriority(type, context)
    };
  }

  private selectTemplate(templates: string[]): string | null {
    // Evitar repetir las mismas frases
    const available = templates.filter(t => !this.usedPhrases.has(t));
    if (available.length === 0) {
      this.usedPhrases.clear(); // Reset si se agotaron
      return templates[Math.floor(Math.random() * templates.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  private fillTemplate(template: string, context: DJContext): string {
    const time = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid'
    });

    return template
      .replace(/{time}/g, time)
      .replace(/{slotName}/g, context.slotName)
      .replace(/{artist}/g, context.currentTrack?.artist || 'un artista')
      .replace(/{title}/g, context.currentTrack?.title || 'una canción')
      .replace(/{nextArtist}/g, context.nextTrack?.artist || 'otro artista')
      .replace(/{nextTitle}/g, context.nextTrack?.title || 'otra canción')
      .replace(/{previousArtist}/g, context.previousTrack?.artist || 'el anterior')
      .replace(/{previousTitle}/g, context.previousTrack?.title || 'la anterior');
  }

  private llmConfig?: LLMConfig;

  setLLMConfig(config: LLMConfig) {
    this.llmConfig = config;
  }

  private async callLLM(prompt: string): Promise<string> {
    if (!this.llmConfig) {
      // Fallback to simple enrichment
      return this.enrichWithSimpleRules(prompt);
    }

    try {
      switch (this.llmConfig.provider) {
        case 'openai':
          return await this.callOpenAI(prompt);
        case 'anthropic':
          return await this.callAnthropic(prompt);
        case 'ollama':
          return await this.callOllama(prompt);
        case 'local':
          return await this.callLocalLLM(prompt);
        default:
          return this.enrichWithSimpleRules(prompt);
      }
    } catch (err) {
      console.error('[AI DJ] LLM call failed, falling back to simple rules:', err);
      return this.enrichWithSimpleRules(prompt);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.llmConfig!.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.llmConfig!.apiKey}`
      },
      body: JSON.stringify({
        model: this.llmConfig!.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: this.llmConfig!.temperature ?? 0.7,
        max_tokens: this.llmConfig!.maxTokens ?? 200
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || prompt;
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch(`${this.llmConfig!.baseUrl || 'https://api.anthropic.com/v1'}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.llmConfig!.apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.llmConfig!.model || 'claude-3-haiku-20240307',
        max_tokens: this.llmConfig!.maxTokens ?? 200,
        temperature: this.llmConfig!.temperature ?? 0.7,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content?.[0]?.text?.trim() || prompt;
  }

  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${this.llmConfig!.baseUrl || 'http://localhost:11434'}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.llmConfig!.model || 'llama3.2',
        prompt: `${this.getSystemPrompt()}\n\nUser: ${prompt}\nAssistant:`,
        stream: false,
        options: {
          temperature: this.llmConfig!.temperature ?? 0.7,
          num_predict: this.llmConfig!.maxTokens ?? 200
        }
      })
    });

    const data = await response.json();
    return data.response?.trim() || prompt;
  }

  private async callLocalLLM(prompt: string): Promise<string> {
    // For local models like LM Studio, Text Generation WebUI, etc.
    const response = await fetch(`${this.llmConfig!.baseUrl || 'http://localhost:1234'}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.llmConfig!.model || 'local-model',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: this.llmConfig!.temperature ?? 0.7,
        max_tokens: this.llmConfig!.maxTokens ?? 200
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || prompt;
  }

  private getSystemPrompt(): string {
    const persona = DJ_PERSONAS[this.persona];
    return `${persona.systemPrompt}

ESTILO: ${persona.style}
VOCABULARIO PREFERIDO: ${persona.vocabulary.join(', ')}
PALABRAS A EVITAR: ${persona.avoidWords.join(', ')}

REGLAS:
- Máximo 2 frases por locución
- Incluye artista y título naturalmente
- Adapta al momento del día (${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })} en Madrid)
- Sé natural, no robótico
- Nunca repitas la misma frase dos veces seguidas`;
  }

  private enrichWithSimpleRules(text: string): string {
    // Fallback simple rules (original logic)
    let enriched = text;
    const persona = DJ_PERSONAS[this.persona];

    if (Math.random() < 0.3 && persona.vocabulary.length > 0) {
      const vocab = persona.vocabulary[Math.floor(Math.random() * persona.vocabulary.length)];
      enriched = `${vocab.charAt(0).toUpperCase() + vocab.slice(1)}, ${enriched.charAt(0).toLowerCase() + enriched.slice(1)}`;
    }

    for (const avoid of persona.avoidWords) {
      enriched = enriched.replace(new RegExp(`\\b${avoid}\\b`, 'gi'), '');
    }

    if (this.persona === 'amigo' && Math.random() < 0.2) {
      enriched = `Oye, ${enriched.charAt(0).toLowerCase() + enriched.slice(1)}`;
    } else if (this.persona === 'energia' && Math.random() < 0.3) {
      enriched = `¡${enriched}!`;
    } else if (this.persona === 'relajado' && Math.random() < 0.2) {
      enriched = `... ${enriched.charAt(0).toLowerCase() + enriched.slice(1)}`;
    }

    return enriched.trim();
  }

  private async enrichWithPersonality(text: string, context: DJContext, persona: typeof DJ_PERSONAS.profesional): Promise<string> {
    // Build contextual prompt for LLM
    const prompt = this.buildPrompt(text, context);
    return await this.callLLM(prompt);
  }

  private buildPrompt(baseText: string, context: DJContext): string {
    const time = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid'
    });

    let prompt = `Contexto: Son las ${time} en Madrid, slot "${context.slotName}". `;

    if (context.currentTrack) {
      prompt += `Canción actual: "${context.currentTrack.title}" de ${context.currentTrack.artist}. `;
    }
    if (context.nextTrack) {
      prompt += `Próxima: "${context.nextTrack.title}" de ${context.nextTrack.artist}. `;
    }
    if (context.previousTrack) {
      prompt += `Anterior: "${context.previousTrack.title}" de ${context.previousTrack.artist}. `;
    }
    if (context.isFirstSong) prompt += 'Es la PRIMERA canción del bloque. ';
    if (context.isLastSongInSlot) prompt += 'Es la ÚLTIMA canción del bloque. ';
    if (context.specialEvent) prompt += `Evento especial: ${context.specialEvent}. `;

    prompt += `\n\nTexto base: "${baseText}"`;
    prompt += '\n\nMejora esta locución para que suene natural, como un locutor real. Máximo 2 frases. Incluye artista y título de forma natural.';

    return prompt;
  }

  private getPriority(type: DJAnnouncement['type'], context: DJContext): number {
    const basePriority = {
      special: 10,
      intro: 9,
      outro: 8,
      timecheck: 6,
      transition: 5,
      promo: 4,
      weather: 3
    };

    let priority = basePriority[type] || 5;

    // Boost si es primera/última canción
    if (context.isFirstSong && type === 'intro') priority += 2;
    if (context.isLastSongInSlot && type === 'outro') priority += 2;

    return Math.min(10, priority);
  }

  // Generar locución completa para un bloque de canciones
  async generateBlockAnnouncements(tracks: Track[], context: DJContext): Promise<DJAnnouncement[]> {
    const announcements: DJAnnouncement[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const nextTrack = tracks[i + 1];
      const prevTrack = tracks[i - 1];

      const trackContext: DJContext = {
        ...context,
        currentTrack: track,
        nextTrack,
        previousTrack: prevTrack,
        isFirstSong: i === 0,
        isLastSongInSlot: i === tracks.length - 1
      };

      // Intro de la primera canción
      if (i === 0) {
        const intro = await this.generateAnnouncement(trackContext, 'intro');
        if (intro) announcements.push(intro);
      }

      // Transición a la siguiente (excepto la última)
      if (i < tracks.length - 1) {
        const transition = await this.generateAnnouncement(trackContext, 'transition');
        if (transition) announcements.push(transition);
      }

      // Outro de la última
      if (i === tracks.length - 1) {
        const outro = await this.generateAnnouncement(trackContext, 'outro');
        if (outro) announcements.push(outro);
      }
    }

    return announcements;
  }
}

// TTS Integration (Text-to-Speech)
export interface TTSProvider {
  name: string;
  synthesize(text: string, voice?: string): Promise<{ audioUrl: string; durationMs: number }>;
  voices: string[];
}

// Proveedores TTS disponibles
export const TTS_PROVIDERS: Record<string, TTSProvider> = {
  elevenlabs: {
    name: 'ElevenLabs',
    voices: ['rachel', 'drew', 'clyde', 'paul', 'sarah', 'antoni', 'elli', 'josh', 'arnold', 'adam'],
    async synthesize(text, voice = 'rachel') {
      // Llamada real a ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const durationMs = estimateAudioDuration(text);
      return { audioUrl, durationMs };
    }
  },
  azure: {
    name: 'Azure Speech',
    voices: ['es-ES-AlvaroNeural', 'es-ES-ElviraNeural', 'es-ES-ArnauNeural', 'es-ES-AbrilNeural'],
    async synthesize(text, voice = 'es-ES-AlvaroNeural') {
      // Implementación Azure Speech SDK
      // Requiere azure-cognitiveservices-speech
      return { audioUrl: '', durationMs: estimateAudioDuration(text) };
    }
  },
  google: {
    name: 'Google Cloud TTS',
    voices: ['es-ES-Standard-A', 'es-ES-Standard-B', 'es-ES-Wavenet-A', 'es-ES-Wavenet-B', 'es-ES-Neural2-A', 'es-ES-Neural2-B'],
    async synthesize(text, voice = 'es-ES-Neural2-A') {
      // Implementación Google Cloud TTS
      return { audioUrl: '', durationMs: estimateAudioDuration(text) };
    }
  },
  browser: {
    name: 'Browser SpeechSynthesis',
    voices: ['default'],
    async synthesize(text) {
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        utterance.onend = () => {
          resolve({ audioUrl: '', durationMs: estimateAudioDuration(text) });
        };
        utterance.onerror = () => {
          resolve({ audioUrl: '', durationMs: estimateAudioDuration(text) });
        };
        speechSynthesis.speak(utterance);
      });
    }
  }
};

function estimateAudioDuration(text: string): number {
  const words = text.split(' ').length;
  return Math.max(2000, (words / 2.5) * 1000); // ~150 palabras/min
}

// DJ Manager - Orquesta todo
export class DJManager {
  private dj: AIDJ;
  private ttsProvider: TTSProvider;
  private announcementQueue: DJAnnouncement[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(persona: DJPersona = 'profesional', ttsProviderName: string = 'browser') {
    this.dj = new AIDJ(persona);
    this.ttsProvider = TTS_PROVIDERS[ttsProviderName] || TTS_PROVIDERS.browser;
  }

  setPersona(persona: DJPersona) {
    this.dj.setPersona(persona);
  }

  async generateAndQueueAnnouncements(tracks: Track[], context: DJContext) {
    const announcements = await this.dj.generateBlockAnnouncements(tracks, context);
    this.announcementQueue.push(...announcements);
    announcements.sort((a, b) => b.priority - a.priority);
  }

  async playNextAnnouncement(): Promise<void> {
    if (this.announcementQueue.length === 0 || this.isPlaying) return;

    const announcement = this.announcementQueue.shift();
    if (!announcement) return;

    this.isPlaying = true;

    try {
      // Generar audio con TTS
      const { audioUrl, durationMs } = await this.ttsProvider.synthesize(announcement.text);

      if (audioUrl) {
        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.volume = 0.8; // Más bajo que la música

        await new Promise<void>((resolve) => {
          if (!this.currentAudio) { resolve(); return; }

          this.currentAudio.onended = () => resolve();
          this.currentAudio.onerror = () => resolve();
          this.currentAudio.play().catch(resolve);
        });
      } else {
        // Fallback: usar SpeechSynthesis del navegador
        await this.speakWithBrowser(announcement.text);
      }
    } catch (err) {
      console.error('[DJ] Error playing announcement:', err);
    } finally {
      this.isPlaying = false;
      this.currentAudio = null;
    }
  }

  private speakWithBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.7;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      speechSynthesis.speak(utterance);
    });
  }

  async playAnnouncementLoop(): Promise<void> {
    while (this.announcementQueue.length > 0) {
      await this.playNextAnnouncement();
      // Pequeña pausa entre anuncios
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  clearQueue() {
    this.announcementQueue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }
}

// Integración con RadioScheduler
export function createDJForSchedule(tracks: Track[], context: DJContext): DJManager {
  const djManager = new DJManager('profesional', 'browser');

  // Generar anuncios para todo el bloque
  djManager.generateAndQueueAnnouncements(tracks, context);

  return djManager;
}