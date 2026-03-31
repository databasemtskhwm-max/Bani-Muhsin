import { GoogleGenAI, Modality } from "@google/genai";

function createWavHeader(pcmDataLength: number, sampleRate: number = 24000) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + pcmDataLength, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * channelCount * bitsPerSample / 8)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channelCount * bitsPerSample / 8)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, pcmDataLength, true);

  return header;
}

export async function generateSpeech(text: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say warmly and with respect: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Gemini 2.5 Flash TTS returns raw PCM (16-bit LE, mono, 24kHz)
      // We need to wrap it in a WAV header for the Audio element to play it
      const binaryString = atob(base64Audio);
      const pcmData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmData[i] = binaryString.charCodeAt(i);
      }

      const wavHeader = createWavHeader(pcmData.length, 24000);
      const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(wavBlob);
      
      const audio = new Audio();
      
      return new Promise((resolve, reject) => {
        audio.src = audioUrl;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve(true);
        };
        audio.onerror = (e) => {
          console.error("Audio element error:", e);
          URL.revokeObjectURL(audioUrl);
          reject(new Error("Failed to play audio source"));
        };
        audio.play().catch(err => {
          console.error("Playback failed:", err);
          URL.revokeObjectURL(audioUrl);
          reject(err);
        });
      });
    } else {
      throw new Error("No audio data received from Gemini");
    }
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}
