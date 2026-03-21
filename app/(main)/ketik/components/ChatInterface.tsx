'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Send, LogOut, Phone, X, Check, CheckCheck, Sparkles, Lock, ArrowLeft, Download, Image as ImageIcon } from 'lucide-react';
import { ChatMessage, SessionConfig, Scenario } from '@/app/types';
import { generateConsumerResponse } from '../services/geminiService';

interface ChatInterfaceProps {
  config: SessionConfig;
  scenario: Scenario;
  onEndSession: (messages: ChatMessage[]) => void;
  isReviewMode?: boolean;
  initialMessages?: ChatMessage[];
}

const TickIcon: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return null;

  const color = status === 'read' ? 'text-primary' : 'text-foreground/30';

  if (status === 'sent') {
    return <Check className={`w-3.5 h-3.5 ${color}`} />;
  }

  return <CheckCheck className={`w-3.5 h-3.5 ${color}`} />;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  config,
  scenario,
  onEndSession,
  isReviewMode = false,
  initialMessages = []
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.simulationDuration * 60);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isReviewMode && !isSessionEnded) {
      textareaRef.current?.focus();
    }
  }, [isReviewMode, isSessionEnded]);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  const handleSessionTimeout = useCallback(async () => {
    setIsTimedOut(true);
    setIsLoading(true);
    
    try {
      const currentHistory = [...messages];
      const responseText = await generateConsumerResponse(config, scenario, currentHistory);
      
      if (responseText !== '[NO_RESPONSE]') {
        const parts = responseText.split('[BREAK]').map(p => p.trim()).filter(p => p);
        let delay = 1000;
        for (const part of parts) {
          const isSystem = part.includes('[SISTEM]');
          const cleanText = part.replace('[SISTEM]', '').trim();
          
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: Date.now().toString() + Math.random(),
              sender: isSystem ? 'system' : 'consumer',
              text: cleanText,
              timestamp: new Date()
            }]);
          }, delay);
          delay += Math.max(1500, cleanText.length * 50);
        }
        setTimeout(() => setIsLoading(false), delay);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error generating timeout response", error);
      setIsLoading(false);
    }
  }, [config, scenario, messages]);

  // Countdown Timer Logic
  useEffect(() => {
    if (isReviewMode || isSessionEnded) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSessionTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isReviewMode, isSessionEnded, handleSessionTimeout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initial System Message
  useEffect(() => {
    if (!isReviewMode && messages.length === 0) {
      setMessages([
        {
          id: Date.now().toString(),
          sender: 'system',
          text: `iMessage with ${config.identity.name}`,
          timestamp: new Date()
        }
      ]);
    }
  }, [isReviewMode, messages.length, config.identity.name]);

  const handleSend = async () => {
    if (!inputText.trim() || isSessionEnded) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'agent',
      text: inputText.trim(),
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (isTimedOut) {
      return;
    }

    setIsLoading(true);

    const currentHistory = [...messages, userMsg];
    
    try {
      // Call Gemini
      const responseText = await generateConsumerResponse(config, scenario, currentHistory);
      
      if (responseText !== '[NO_RESPONSE]') {
        const parts = responseText.split('[BREAK]').map(p => p.trim()).filter(p => p);
        
        let delay = 1000;
        for (const part of parts) {
          const isSystem = part.includes('[SISTEM]');
          const cleanText = part.replace('[SISTEM]', '').trim();
          
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: Date.now().toString() + Math.random(),
              sender: isSystem ? 'system' : 'consumer',
              text: cleanText,
              timestamp: new Date()
            }]);
          }, delay);
          delay += Math.max(1500, cleanText.length * 50); // Simulate typing time
        }
        
        setTimeout(() => setIsLoading(false), delay);
      } else {
        setIsLoading(false);
        setIsTimedOut(true); // Mark as timed out/ended naturally
      }
    } catch (error) {
      console.error("Error generating response", error);
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        sender: 'system',
        text: 'Terjadi gangguan koneksi dengan konsumen. Coba kirim pesan lagi.',
        timestamp: new Date()
      }]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyTemplate = () => {
    const hour = new Date().getHours();
    let greeting = "Pagi";
    if (hour >= 11 && hour < 15) greeting = "Siang";
    else if (hour >= 15) greeting = "Sore";

    const agentName = config.identity.signatureName || "Petugas";
    const consumerName = config.identity.name;
    
    const template = `Anda telah terhubung dengan Layanan Kontak OJK 157. Selamat ${greeting}. Saya ${agentName} dengan senang hati memberikan informasi yang Bapak/Ibu ${consumerName} butuhkan seputar Sektor Jasa Keuangan. Perihal apa yang dapat kami bantu?`;
    
    setInputText(template);
    textareaRef.current?.focus();
  };

  const renderMessageContent = (text: string) => {
    const scenarioImages = (scenario as any).images || [];
    const parts = text.split(/(\[SEND_IMAGE: \d+\])/g);
    
    return parts.map((part, index) => {
        const match = part.match(/\[SEND_IMAGE: (\d+)\]/);
        if (match) {
            const imgIndex = parseInt(match[1]);
            const imgSrc = scenarioImages[imgIndex];
            
            if (imgSrc) {
                return (
                    <motion.div 
                        key={index} 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="my-2"
                    >
                    <Image 
                        src={imgSrc} 
                        alt={`Attachment ${imgIndex}`} 
                        width={400}
                        height={400}
                        className="rounded-2xl max-h-64 w-full object-cover border border-gray-200 dark:border-white/10 cursor-pointer hover:opacity-90 transition-all"
                        onClick={() => setSelectedImage(imgSrc)}
                        referrerPolicy="no-referrer"
                    />
                    </motion.div>
                );
            }
            return null;
        }
        return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      {/* 1. Premium Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 shrink-0 bg-card/50 backdrop-blur-2xl w-full z-50 relative">
        <div className="flex items-center gap-4 w-1/4">
            {isReviewMode && (
                <button 
                    onClick={() => onEndSession(messages)}
                    className="flex items-center gap-2 text-foreground/40 hover:text-foreground transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-all">
                      <ArrowLeft className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Kembali</span>
                </button>
            )}
            {!isReviewMode && (
                 <div className="w-12 h-12 rounded-2xl overflow-hidden bg-foreground/5 shrink-0 relative border border-border/50">
                    <Image 
                        src={`https://picsum.photos/seed/${config.identity.name}/200`} 
                        alt="Avatar" 
                        fill
                        className="object-cover" 
                        referrerPolicy="no-referrer"
                    />
                </div>
            )}
        </div>

        <div className="flex flex-col items-center justify-center w-2/4">
            <h1 className="font-black text-foreground text-xl tracking-tighter truncate max-w-full text-center">
                {config.identity.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 bg-foreground/5 px-4 py-1 rounded-full border border-border/50">
                <div className="flex items-center gap-1.5">
                   <Phone className="w-3 h-3 text-primary" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">{config.identity.phone}</span>
                </div>
                <span className="w-1 h-1 bg-foreground/20 rounded-full"></span>
                <div className="flex items-center gap-1.5">
                   <div className="text-[10px] text-primary">📍</div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">{config.identity.city}</span>
                </div>
            </div>
            {!isReviewMode ? (
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Active Now</span>
                    <span className="w-1 h-1 bg-primary rounded-full animate-pulse"></span>
                </div>
            ) : (
                <div className="flex items-center gap-2 mt-0.5">
                    <Lock className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Review Mode</span>
                </div>
            )}
        </div>
        
        <div className="flex items-center justify-end gap-3 w-1/4">
            {isReviewMode ? (
                <button 
                    onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8,Pengirim,Pesan,Waktu\n" + 
                            messages.map(m => {
                                const sender = m.sender === 'agent' ? 'Agen' : m.sender === 'consumer' ? 'Konsumen' : 'Sistem';
                                const text = m.text.replace(/"/g, '""');
                                const time = new Date(m.timestamp).toLocaleString();
                                return `"${sender}","${text}","${time}"`;
                            }).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `chat_review_${Date.now()}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground rounded-2xl transition-all border border-border/50 shadow-sm"
                    title="Download CSV"
                >
                    <Download className="w-5 h-5" />
                </button>
            ) : (
                <button 
                    onClick={() => onEndSession(messages)}
                    className="px-6 py-2.5 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all rounded-xl shadow-lg shadow-red-500/20"
                >
                    Selesai
                </button>
            )}
        </div>
      </div>

      {/* 2. Messages Area */}
      <div className="flex-1 overflow-y-auto z-10 scroll-smooth custom-scrollbar flex flex-col p-4 space-y-2 bg-background">
        <AnimatePresence initial={false}>
            {messages.map((msg, index) => {
               if (msg.sender === 'system') {
                   return (
                       <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center py-4"
                       >
                           <p className="text-[10px] font-medium text-muted-foreground text-center uppercase tracking-wide">
                               {msg.text}
                           </p>
                       </motion.div>
                   );
               }
               
               const isAgent = msg.sender === 'agent';

               return (
                <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'}`}
                >
                    <div 
                        className={`max-w-[80%] px-5 py-3 relative text-[15px] leading-relaxed shadow-sm
                        ${isAgent 
                            ? 'bg-primary text-primary-foreground rounded-[1.5rem] rounded-tr-none shadow-primary/20' 
                            : 'bg-card border border-border/50 text-foreground rounded-[1.5rem] rounded-tl-none'
                        }`}
                    >
                        <div className="font-medium">
                            {renderMessageContent(msg.text)}
                        </div>
                        {/* Timestamp */}
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center justify-end gap-2 mt-2 ${isAgent ? 'text-white/60' : 'text-foreground/30'}`}>
                             <span>
                                {!isNaN(new Date(msg.timestamp).getTime()) 
                                    ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                    : ''}
                            </span>
                            {isAgent && <TickIcon status={msg.status} />}
                        </div>
                    </div>
                </motion.div>
               )
            })}
        </AnimatePresence>
        
        {isLoading && (
             <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-start"
             >
                <div className="bg-foreground/5 rounded-[20px] rounded-bl-sm px-4 py-3">
                    <div className="flex space-x-1">
                        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                        <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                    </div>
                </div>
            </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isReviewMode ? (
        <div className="p-6 bg-card border-t border-border/50 z-40 shrink-0 backdrop-blur-3xl relative">
          <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          
          {/* Template Button */}
          <div className="flex justify-center mb-6">
             <button 
                onClick={applyTemplate}
                className="flex items-center gap-2.5 px-6 py-2.5 bg-background/50 hover:bg-background rounded-2xl shadow-sm border border-border/50 text-[10px] font-black uppercase tracking-widest text-primary hover:border-primary/50 transition-all group"
             >
                <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                <span>Gunakan Template Salam</span>
             </button>
          </div>

          <div className="max-w-4xl mx-auto flex items-end gap-4">
              <div className="flex-1 bg-background/50 rounded-[2rem] border-2 border-border/50 flex flex-col px-6 py-2.5 focus-within:border-primary focus-within:bg-background transition-all shadow-inner">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20 mb-1 ml-1 select-none">Pesan Baru</span>
                  <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Tulis pesan Anda..."
                      className="w-full bg-transparent border-none outline-none resize-none max-h-48 min-h-[40px] py-1 text-base text-foreground placeholder-foreground/20 font-medium"
                      rows={1}
                  />
              </div>
              <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center transition-all ${
                      inputText.trim() 
                      ? 'bg-primary text-white shadow-2xl shadow-primary/20' 
                      : 'bg-foreground/5 text-foreground/20'
                  }`}
              >
                  <Send className={`w-6 h-6 ${inputText.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
              </motion.button>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-card border-t border-border/50 z-40 shrink-0 text-center flex items-center justify-center gap-3">
          <Lock className="w-4 h-4 text-orange-500/50" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-foreground/30">
            Mode Review &bull; Hanya Baca
          </span>
        </div>
      )}

      {/* Image Lightbox */}
      <AnimatePresence>
        {selectedImage && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 cursor-pointer"
                onClick={() => setSelectedImage(null)}
            >
                <motion.img 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    src={selectedImage} 
                    alt="Full preview" 
                    className="max-w-full max-h-full rounded-xl shadow-2xl"
                    referrerPolicy="no-referrer"
                />
                <button className="absolute top-6 right-6 bg-gray-800/50 text-white p-2 rounded-full backdrop-blur-md">
                    <X className="w-6 h-6" />
                </button>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
