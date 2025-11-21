import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { base64ToUint8Array, createPCM16Blob, decodeAudioData } from '../utils/audio';
import { AudioVisualizer } from './AudioVisualizer';
import { LiveSessionConfig } from '../types';

interface LiveSessionProps {
  config: LiveSessionConfig;
  onEndSession: (transcript: string) => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ config, onEndSession }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  
  // Audio Context and Node Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Session Refs
  const sessionRef = useRef<any>(null); // Stores the session promise/object
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Transcription storage
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    connectToLiveApi();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Close session if possible (API doesn't explicitly expose close on the promise wrapper easily, 
    // but stopping the stream and context effectively kills the loop)
    // In a real app, we might need to send a close signal if supported.
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
  };

  const connectToLiveApi = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      // Input: 16kHz required by Gemini Live
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Output: 24kHz recommended for Gemini Live
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: config.systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            startAudioInput(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onclose: () => {
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection lost. Please try again.");
            setIsConnected(false);
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection failed:", err);
      setError(err.message || "Failed to access microphone or connect to API.");
    }
  };

  const startAudioInput = (stream: MediaStream, sessionPromise: Promise<any>) => {
    if (!inputContextRef.current) return;

    const source = inputContextRef.current.createMediaStreamSource(stream);
    // Buffer size 4096 offers a balance between latency and performance
    const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (isMuted) return; 

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPCM16Blob(inputData);

      sessionPromise.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(processor);
    processor.connect(inputContextRef.current.destination);
    
    sourceRef.current = source;
    processorRef.current = processor;
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const { serverContent } = message;
    if (!serverContent || !audioContextRef.current) return;

    // Handle Interruptions
    if (serverContent.interrupted) {
      sourcesRef.current.forEach((source) => {
        source.stop();
      });
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      setIsAiSpeaking(false);
      return;
    }

    // Handle Transcripts (Accumulate for plan generation)
    if (serverContent.modelTurn?.turnComplete) {
       setIsAiSpeaking(false);
    }

    if (serverContent.inputTranscription?.text) {
        transcriptRef.current += `User: ${serverContent.inputTranscription.text}\n`;
    }
    if (serverContent.outputTranscription?.text) {
        transcriptRef.current += `Tutor: ${serverContent.outputTranscription.text}\n`;
    }

    // Handle Audio Output
    const base64Audio = serverContent.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      setIsAiSpeaking(true);
      const ctx = audioContextRef.current;
      const audioData = base64ToUint8Array(base64Audio);
      
      try {
        const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
        
        // Schedule audio
        const currentTime = ctx.currentTime;
        // If nextStartTime is in the past, reset it to now
        if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        
        sourcesRef.current.add(source);
        source.onended = () => {
          sourcesRef.current.delete(source);
          if (sourcesRef.current.size === 0) {
             // Only set to false if no other sources are playing/scheduled very soon
             // This is a rough approximation for visualizer
             setTimeout(() => {
                 if (sourcesRef.current.size === 0) setIsAiSpeaking(false);
             }, 200);
          }
        };

      } catch (e) {
        console.error("Error decoding audio", e);
      }
    }
  };

  const handleEndSession = () => {
    cleanup();
    onEndSession(transcriptRef.current);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[50vh] bg-gradient-to-b from-gray-50 to-gray-100 rounded-3xl p-6 shadow-xl border border-white/50 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
         <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-300 rounded-full blur-3xl"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-purple-300 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-10">
        {/* Status Indicator */}
        <div className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          isConnected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
        }`}>
          {error ? 'Error' : isConnected ? 'Connected' : 'Connecting...'}
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center max-w-xs">{error}</p>
        )}

        {/* Main Visualizer */}
        <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Outer Glow */}
            <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl transition-opacity duration-500 ${isAiSpeaking ? 'opacity-20' : 'opacity-5'}`}></div>
            <div className="bg-white rounded-full p-8 shadow-2xl ring-4 ring-gray-50/50 relative">
               <AudioVisualizer isActive={isAiSpeaking || (!isMuted && isConnected)} role={isAiSpeaking ? 'ai' : 'user'} />
            </div>
        </div>

        <div className="text-center space-y-2">
           <h3 className="text-xl font-semibold text-gray-800">
             {isAiSpeaking ? "Tutor is speaking..." : isMuted ? "Microphone muted" : "Listening to you..."}
           </h3>
           <p className="text-sm text-gray-500 max-w-xs mx-auto">
             Speak naturally. The AI will respond in real-time.
           </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all transform hover:scale-105 shadow-lg ${
              isMuted 
              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          <button 
            onClick={handleEndSession}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};