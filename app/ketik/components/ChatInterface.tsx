'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Send, LogOut, Phone, X, Check, CheckCheck, Sparkles, Lock, ArrowLeft, Download, Image as ImageIcon } from 'lucide-react';
import { ChatMessage, SessionConfig, Scenario } from '../../types';
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

  // iOS doesn't typically show ticks in the same way, but for functionality we keep them subtle
  const color = status === 'read' ? 'text-blue-100' : 'text-blue-200/70';

  if (status === 'sent') {
    return <Check className={`w-3 h-3 ${color}`} />;
  }

  return <CheckCheck className={`w-3 h-3 ${color}`} />;
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
      {/* 1. iOS Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 shrink-0 bg-card/80 backdrop-blur-xl w-full z-50 relative">
        <div className="flex items-center gap-2 w-1/4">
            {isReviewMode && (
                <button 
                    onClick={() => onEndSession(messages)}
                    className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors pr-2"
                >
                    <ArrowLeft className="w-6 h-6" />
                    <span className="text-base font-medium hidden sm:inline">Kembali</span>
                </button>
            )}
            {!isReviewMode && (
                 <div className="w-9 h-9 rounded-full overflow-hidden bg-foreground/10 shrink-0 relative">
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
            <h1 className="font-bold text-foreground text-sm sm:text-base truncate max-w-full text-center">
                {config.identity.name}
            </h1>
            {!isReviewMode ? (
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
                    <span className="truncate max-w-[80px] sm:max-w-[120px]">{config.identity.phone}</span>
                    <span className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></span>
                    <span className="truncate max-w-[60px] sm:max-w-[100px]">{config.identity.city}</span>
                </div>
            ) : (
                <span className="text-[10px] text-muted-foreground">Review Mode</span>
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
                    className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-2 rounded-full transition-all"
                    title="Download CSV"
                >
                    <Download className="w-5 h-5" />
                </button>
            ) : (
                <button 
                    onClick={() => onEndSession(messages)}
                    className="text-red-500 font-medium text-sm hover:opacity-70 transition-opacity bg-red-500/10 px-3 py-1.5 rounded-full"
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
                        className={`max-w-[75%] px-4 py-2 relative text-[15px] leading-snug break-words
                        ${isAgent 
                            ? 'bg-blue-500 text-white rounded-[20px] rounded-br-sm' 
                            : 'bg-foreground/5 text-foreground rounded-[20px] rounded-bl-sm'
                        }`}
                    >
                        <div>
                            {renderMessageContent(msg.text)}
                        </div>
                        {/* Timestamp */}
                        <div className={`text-[9px] flex items-center justify-end gap-1 mt-1 opacity-70 ${isAgent ? 'text-blue-100' : 'text-muted-foreground'}`}>
                             <span>
                                {!isNaN(new Date(msg.timestamp).getTime()) 
                                    ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                    : ''}
                            </span>
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
        <div className="p-3 bg-card border-t border-border/50 z-40 shrink-0 backdrop-blur-xl">
          {/* Template Button */}
          <div className="flex justify-center mb-2">
             <button 
                onClick={applyTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-full shadow-sm border border-border text-[11px] font-bold text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
             >
                <Sparkles className="w-3 h-3" />
                <span>Gunakan Template Salam</span>
             </button>
          </div>

          <div className="max-w-4xl mx-auto flex items-end gap-3">
              <div className="flex-1 bg-background rounded-[20px] border border-border flex items-center px-4 py-1 focus-within:border-blue-500 transition-colors">
                  <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="iMessage"
                      className="w-full bg-transparent border-none outline-none resize-none max-h-32 min-h-[36px] py-2 text-[15px] text-foreground placeholder-muted-foreground"
                      rows={1}
                  />
              </div>
              <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className={`w-9 h-9 rounded-full flex items-center justify-center mb-1 transition-all ${
                      inputText.trim() 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'bg-foreground/10 text-muted-foreground'
                  }`}
              >
                  <ArrowLeft className="w-5 h-5 rotate-90 font-bold" strokeWidth={3} />
              </motion.button>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-card border-t border-border/50 z-40 shrink-0 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Review Mode &bull; Read Only
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
