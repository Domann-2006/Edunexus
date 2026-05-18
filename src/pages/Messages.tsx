import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, limit, updateDoc, increment } from 'firebase/firestore';
import { Send, Search, CheckCheck, Loader2, School as SchoolIcon, ChevronLeft, MoreVertical, Paperclip, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { schoolService } from '../services/api';
import { useLocation } from 'react-router-dom';

export default function Messages({ user }: { user: any }) {
  const location = useLocation();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSuper = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuper) {
      fetchSchools();
    } else {
      // School Admin: Fixed chat with Super Admin
      setSelectedChat({
        id: user.schoolId,
        name: 'Super Admin Support',
        isSupport: true
      });
      setShowSidebar(false);
    }
  }, []);

  // Handle deep linking from navigation state
  useEffect(() => {
    if (isSuper && location.state?.selectedChatId) {
      const targetSchool = schools.find(s => s.id === location.state.selectedChatId);
      setSelectedChat({
        id: location.state.selectedChatId,
        name: location.state.selectedSchoolName || targetSchool?.name || 'School Admin'
      });
      if (window.innerWidth < 1024) setShowSidebar(false);
    }
  }, [location.state, schools]);

  const fetchSchools = async () => {
    try {
      const res = await schoolService.list();
      setSchools(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = isSuper ? convos : convos.filter((c: any) => c.id === user.schoolId);
      setConversations(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isSuper]);

  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setMessages(msgs);
      scrollToBottom();
      
      // Mark as read (optional logic: if last message wasn't mine)
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.senderId !== user.id) {
         updateDoc(doc(db, 'chats', selectedChat.id), {
           unreadCount: 0
         }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [selectedChat, user.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const text = newMessage;
      setNewMessage('');

      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
        text,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: text,
        lastSenderId: user.id,
        updatedAt: serverTimestamp(),
        schoolId: selectedChat.id,
        schoolName: selectedChat.name || 'Unknown School',
        unreadCount: increment(1)
      }, { merge: true });

    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const filteredSchoolsList = schools.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] flex bg-[#f0f2f5] rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar */}
      {(isSuper && (showSidebar || window.innerWidth >= 1024)) && (
        <div className={`w-full lg:w-[400px] border-r border-gray-200 flex flex-col bg-white overflow-hidden ${!showSidebar && 'hidden lg:flex'}`}>
          <div className="p-4 bg-[#f0f2f5] flex items-center justify-between">
             <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold uppercase">
               {user.name.charAt(0)}
             </div>
             <div className="flex gap-4 text-gray-500">
                <MoreVertical size={20} className="cursor-pointer" />
             </div>
          </div>
          
          <div className="p-3">
             <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold" />
                <input 
                  type="text" 
                  placeholder="Search or start new chat"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-2 bg-[#f0f2f5] border-transparent rounded-lg text-sm font-medium focus:ring-0 outline-none"
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
             {loading ? (
               <div className="flex flex-col items-center justify-center py-20 gap-3">
                 <Loader2 className="animate-spin text-emerald-500" size={24} />
               </div>
             ) : (
               filteredSchoolsList.map(school => {
                 const convo = conversations.find(c => c.id === school.id);
                 const isSelected = selectedChat?.id === school.id;
                 return (
                   <button 
                     key={school.id}
                     onClick={() => {
                        setSelectedChat(school);
                        if (window.innerWidth < 1024) setShowSidebar(false);
                     }}
                     className={`w-full p-4 flex items-center gap-4 transition-colors border-b border-gray-50 ${
                       isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-gray-50'
                     }`}
                   >
                     <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center shrink-0 font-black">
                       {school.name.charAt(0)}
                     </div>
                     <div className="flex-1 text-left overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-900 truncate">{school.name}</span>
                          {convo?.updatedAt && (
                            <span className="text-[10px] text-gray-400 font-bold">
                              {convo.updatedAt.toDate ? convo.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                           <div className="text-xs text-gray-500 truncate max-w-[200px]">
                             {convo ? convo.lastMessage : 'Tap to start...'}
                           </div>
                           {convo?.unreadCount > 0 && !isSelected && (
                             <div className="bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                               {convo.unreadCount}
                             </div>
                           )}
                        </div>
                     </div>
                   </button>
                 )
               })
             )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col relative bg-[#efeae2] ${showSidebar && isSuper && 'hidden lg:flex'}`}>
        {/* Chat Wallpaper Pattern would go here */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />

        {!selectedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-[#f8f9fa] relative z-10">
             <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-8">
               <Send size={48} className="rotate-12" />
             </div>
             <h3 className="text-3xl font-light text-gray-600 tracking-tight">EduNexus Web</h3>
             <p className="text-sm text-gray-400 mt-4 max-w-sm leading-relaxed">
               Select a school to start an encrypted administrative uplink. Use this for direct coordination and support with institute heads.
             </p>
             <div className="mt-20 flex items-center gap-2 text-gray-300 text-[10px] font-bold uppercase tracking-widest">
               <CheckCheck size={14} />
               End-to-end encrypted
             </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 bg-[#f0f2f5] border-b border-gray-200 flex items-center justify-between relative z-10">
               <div className="flex items-center gap-4">
                  {isSuper && (
                    <button onClick={() => setShowSidebar(true)} className="lg:hidden p-2 text-gray-500">
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  <div className="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center font-black">
                    {selectedChat.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 leading-tight">{selectedChat.name}</div>
                    <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</div>
                  </div>
               </div>
               <div className="flex items-center gap-4 text-gray-500">
                  <Search size={20} className="cursor-pointer" />
                  <MoreVertical size={20} className="cursor-pointer" />
               </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-10 space-y-2 relative z-10 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex justify-center py-20">
                   <div className="bg-amber-100 text-amber-800 text-[10px] font-bold px-4 py-1.5 rounded-lg shadow-sm uppercase tracking-widest flex items-center gap-2">
                     <CheckCheck size={12} />
                     Uplink Established
                   </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.senderId === user.id;
                  const showDate = i === 0 || (msg.createdAt?.toDate && messages[i-1].createdAt?.toDate && msg.createdAt.toDate().toDateString() !== messages[i-1].createdAt.toDate().toDateString());
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-6">
                           <div className="bg-white/50 backdrop-blur px-3 py-1 rounded-lg text-[10px] font-bold text-gray-500 uppercase">
                             {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Today'}
                           </div>
                        </div>
                      )}
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`relative max-w-[85%] px-3 py-2 rounded-lg shadow-sm text-sm ${
                          isMine ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                        }`}>
                          <div className="pr-12">
                            {msg.text}
                          </div>
                          <div className="absolute bottom-1 right-2 flex items-center gap-1">
                             <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap uppercase">
                               {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                             </span>
                             {isMine && <CheckCheck size={12} className="text-[#53bdeb]" />}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 bg-[#f0f2f5] border-t border-gray-200 relative z-10">
               <form onSubmit={sendMessage} className="flex items-center gap-3">
                  <div className="flex gap-4 text-gray-500 px-2">
                     <Smile size={24} className="cursor-pointer" />
                     <Paperclip size={24} className="cursor-pointer" />
                  </div>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message"
                    className="flex-1 px-4 py-2 bg-white border-transparent rounded-lg text-sm font-medium focus:ring-1 focus:ring-emerald-500/10 outline-none"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                      newMessage.trim() ? 'bg-emerald-500 text-white' : 'text-gray-400'
                    }`}
                  >
                    <Send size={20} />
                  </button>
               </form>
            </div>
          </>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cdcdcd;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #aab;
        }
      `}</style>
    </div>
  );
}

