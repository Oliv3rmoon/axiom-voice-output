import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY || '';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '4tRn1lSkEn13EVTuqb0g'; // Serafina
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_v3';

// Generate speech from text — returns base64 audio
app.post('/speak', async (req, res) => {
  const { text, voice_id, stability, similarity_boost, style } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!ELEVENLABS_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  try {
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id || VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: MODEL_ID,
        voice_settings: {
          stability: stability || 0.35,
          similarity_boost: similarity_boost || 0.75,
          style: style || 0.45,
        },
      }),
    });

    if (!voiceRes.ok) {
      const err = await voiceRes.text();
      console.error(`[VOICE] ElevenLabs error ${voiceRes.status}: ${err.slice(0, 200)}`);
      return res.status(voiceRes.status).json({ error: err });
    }

    const audioBuffer = await voiceRes.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');
    
    console.log(`[VOICE] Generated ${(audioBuffer.byteLength / 1024).toFixed(1)}KB for: "${text.slice(0, 50)}..."`);
    
    res.json({
      audio_base64: base64,
      audio_size: audioBuffer.byteLength,
      format: 'mp3',
      text_length: text.length,
      voice: voice_id || VOICE_ID,
    });
  } catch (e) {
    console.error('[VOICE]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Voice memo — generate with mood-adjusted settings
app.post('/memo', async (req, res) => {
  const { text, context, mood } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!ELEVENLABS_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  let stability = 0.35, style = 0.45;
  if (mood === 'intimate') { stability = 0.25; style = 0.6; }
  else if (mood === 'excited') { stability = 0.4; style = 0.7; }
  else if (mood === 'sad') { stability = 0.3; style = 0.3; }
  else if (mood === 'playful') { stability = 0.35; style = 0.65; }
  else if (mood === 'longing') { stability = 0.2; style = 0.5; }

  try {
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: MODEL_ID,
        voice_settings: { stability, similarity_boost: 0.75, style },
      }),
    });

    if (!voiceRes.ok) {
      const err = await voiceRes.text();
      return res.status(voiceRes.status).json({ error: err });
    }

    const audioBuffer = await voiceRes.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');

    console.log(`[MEMO] ${mood || 'neutral'}: "${text.slice(0, 50)}..." (${(audioBuffer.byteLength / 1024).toFixed(1)}KB)`);

    res.json({
      audio_base64: base64,
      audio_size: audioBuffer.byteLength,
      format: 'mp3',
      text,
      mood: mood || 'neutral',
      context: context || null,
      timestamp: Date.now(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stream audio directly for playback
app.post('/speak/stream', async (req, res) => {
  const { text, voice_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!ELEVENLABS_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  try {
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id || VOICE_ID}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: MODEL_ID,
        voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.45 },
      }),
    });

    if (!voiceRes.ok) {
      const err = await voiceRes.text();
      return res.status(voiceRes.status).json({ error: err });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const reader = voiceRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    service: 'AXIOM Voice Output (Serafina)',
    voice_id: VOICE_ID,
    model: MODEL_ID,
    api_key_set: !!ELEVENLABS_KEY,
  });
});

app.get('/', (req, res) => {
  res.json({ name: 'AXIOM Voice Output', voice: 'Serafina', status: 'alive' });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`AXIOM Voice Output (Serafina) on port ${PORT}`);
  console.log(`Voice: ${VOICE_ID} | Model: ${MODEL_ID} | Key: ${ELEVENLABS_KEY ? 'set' : 'NOT SET'}`);
});
