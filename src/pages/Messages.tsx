import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, limit } from 'firebase/firestore';
import { Send, Search, User, Check, CheckCheck, Loader2, School as SchoolIcon } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSuper = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuper) {
      fetchSchools();
      // Handle navigation state if passed
      if (location.state?.selectedChatId) {
        setSelectedChat({
          id: location.state.selectedChatId,
          name: location.state.selectedSchoolName || 'School Admin'
        });
      }
    } else {
      // School Admin: Select their own school chat automatically
      setSelectedChat({
        id: user.schoolId,
        name: 'Super Admin Support',
        schoolId: user.schoolId
      });
    }
  }, [location.state]);

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
    
    // For School Admin, we only want their own chat
    // Actually, rules will handle security, but we should only show theirs in the list
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
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [selectedChat]);

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

      // 1. Add Message
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
        text,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        createdAt: serverTimestamp(),
      });

      // 2. Update Chat Metadata (ensure chat doc exists)
      await setDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: text,
        lastSenderId: user.id,
        updatedAt: serverTimestamp(),
        schoolId: selectedChat.id,
        schoolName: selectedChat.name || 'Unknown School'
      }, { merge: true });

    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const filteredConversations = isSuper 
    ? schools.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="h-[calc(100vh-140px)] flex bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Sidebar - Only for Super Admin */}
      {isSuper && (
        <div className="w-80 border-r border-gray-50 flex flex-col bg-gray-50/30">
          <div className="p-6">
             <h2 className="text-xl font-black text-gray-900 tracking-tight mb-6">School Chats</h2>
             <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search interactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-6">
             {loading ? (
               <div className="flex flex-col items-center justify-center py-10 gap-3">
                 <Loader2 className="animate-spin text-blue-600" size={20} />
                 <span className="text-[10px] font-black uppercase text-gray-400">Loading Matrix...</span>
               </div>
             ) : filteredConversations.length === 0 ? (
               <div className="text-center py-10 px-6 italic text-gray-400 text-xs">No active nodes found.</div>
             ) : (
               filteredConversations.map(school => {
                 const convo = conversations.find(c => c.id === school.id);
                 const isSelected = selectedChat?.id === school.id;
                 return (
                   <button 
                     key={school.id}
                     onClick={() => setSelectedChat(school)}
                     className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all ${
                       isSelected ? 'bg-white shadow-md scale-[1.02]' : 'hover:bg-white/50'
                     }`}
                   >
                     <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100 overflow-hidden">
                       {school.logoUrl ? <img src={school.logoUrl} className="w-full h-full object-cover" /> : <SchoolIcon size={20} />}
                     </div>
                     <div className="text-left overflow-hidden">
                        <div className="font-bold text-gray-900 truncate tracking-tight">{school.name}</div>
                        <div className="text-[10px] font-bold text-gray-400 truncate uppercase mt-0.5">
                          {convo ? convo.lastMessage : 'Start conversation...'}
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
      <div className="flex-1 flex flex-col relative bg-white">
        {!selectedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 gap-6">
             <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center text-gray-300">
               <Send size={40} className="rotate-12" />
             </div>
             <div>
               <h3 className="text-2xl font-black text-gray-900 tracking-tighter italic">Secured Communication Uplink</h3>
               <p className="text-xs text-gray-500 font-medium max-w-[280px] mt-2">Select a school from the directory to establish an encrypted management channel.</p>
             </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center uppercase font-black text-xs">
                    {selectedChat.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <div className="font-black text-gray-900 tracking-tight">{selectedChat.name}</div>
                    <div className="flex items-center gap-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Secured Node</span>
                    </div>
                  </div>
               </div>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              {messages.length === 0 ? (
                <div className="text-center py-20 italic text-gray-400 text-xs">No transmission history detected. Start a new log...</div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.senderId === user.id;
                  const showHeader = i === 0 || messages[i-1].senderId !== msg.senderId;
                  
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, x: isMine ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      {showHeader && (
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 mx-2">
                           {isMine ? 'You' : msg.senderName}
                        </span>
                      )}
                      <div className={`max-w-[70%] p-4 rounded-3xl text-sm font-medium shadow-sm transition-all ${
                        isMine ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-gray-50 text-gray-900 rounded-tl-none'
                      }`}>
                        {msg.text}
                        <div className="mt-1 flex items-center justify-end gap-1">
                           <span className="text-[8px] opacity-50 font-bold uppercase">
                             {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                           </span>
                           {isMine && <CheckCheck size={10} className="opacity-50" />}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-8 bg-white border-t border-gray-50">
               <form onSubmit={sendMessage} className="flex items-center gap-4 relative">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Enter management directive..."
                    className="flex-1 pl-6 pr-20 py-5 bg-gray-50 border-0 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-gray-900"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-gray-900 text-white rounded-xl hover:bg-black transition-all active:scale-90 disabled:opacity-30"
                  >
                    <Send size={18} />
                  </button>
               </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
