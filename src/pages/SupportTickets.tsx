import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2, 
  Filter, 
  Send,
  User,
  Building,
  Tag,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ticketService } from '../services/api';

const CATEGORIES = [
  'TECHNICAL', 'BILLING', 'FEATURE', 'ACCOUNT', 'BUG', 'VERIFICATION', 'GENERAL'
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUSES = ['OPEN', 'IN_PROGRESS', 'AWAITING_RESPONSE', 'RESOLVED', 'CLOSED'];

export default function SupportTickets({ user }: { user: any }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const isSuper = user?.role === 'SUPER_ADMIN';

  const [formData, setFormData] = useState({
    subject: '',
    category: 'TECHNICAL',
    priority: 'MEDIUM',
    message: ''
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await ticketService.list();
      setTickets(res.data);
    } catch (err: any) {
      console.error('Fetch tickets failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const ticketId = `TIC-${Math.floor(1000 + Math.random() * 9000)}`;
      await ticketService.create({
        ...formData,
        ticketId,
        schoolName: user?.schoolName || 'Internal System',
        submittedBy: user?.id,
        submittedByName: user?.name,
        status: 'OPEN',
        responses: []
      });
      setIsModalOpen(false);
      setFormData({ subject: '', category: 'TECHNICAL', priority: 'MEDIUM', message: '' });
      setToast({ message: 'Ticket submitted successfully', type: 'success' });
      fetchTickets();
    } catch (err: any) {
      setToast({ message: 'Failed to submit ticket', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (ticket: any, newStatus: string) => {
    try {
      await ticketService.update(ticket.id, { status: newStatus });
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));
      if (viewTicket?.id === ticket.id) {
        setViewTicket({ ...viewTicket, status: newStatus });
      }
      setToast({ message: `Status updated to ${newStatus}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Update failed', type: 'error' });
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !viewTicket) return;

    try {
      const existingReplies = viewTicket.replies || [];
      const updatedReplies = [...existingReplies, {
        text: replyText,
        sentBy: user.name,
        sentByRole: user.role,
        sentAt: new Date().toISOString()
      }];
      const newStatus = user.role === 'SUPER_ADMIN' ? 'AWAITING_RESPONSE' : viewTicket.status;

      await ticketService.update(viewTicket.id, {
        replies: updatedReplies,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      const updatedTicket = { 
        ...viewTicket, 
        replies: updatedReplies,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      setViewTicket(updatedTicket);
      setTickets(prev => prev.map(t => t.id === viewTicket.id ? updatedTicket : t));
      setReplyText('');
      setToast({ message: 'Response sent', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to send reply', type: 'error' });
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.ticketId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.schoolName?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-rose-50 text-rose-600';
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-600';
      case 'AWAITING_RESPONSE': return 'bg-amber-50 text-amber-600';
      case 'RESOLVED': return 'bg-emerald-50 text-emerald-600';
      default: return 'bg-gray-50 text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-rose-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-blue-500 text-white';
      case 'LOW': return 'bg-emerald-500 text-white';
      default: return 'bg-gray-300 text-white';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Support Center</h1>
          <p className="text-gray-500 font-medium mt-1">
            {isSuper ? 'Manage global support tickets and system complaints.' : 'Submit and track your school support requests.'}
          </p>
        </div>
        {!isSuper && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-gray-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95 translate-y-0 hover:-translate-y-1"
          >
            <Plus size={18} />
            <span>Submit New Ticket</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Column */}
        <div className="space-y-4">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">Overview</div>
            <div className="space-y-5">
              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <Clock size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-600">Total Tickets</span>
                </div>
                <span className="text-lg font-black text-gray-900">{tickets.length}</span>
              </div>
              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <AlertCircle size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-600">Open</span>
                </div>
                <span className="text-lg font-black text-rose-600">{tickets.filter(t => t.status === 'OPEN').length}</span>
              </div>
              <div className="flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-sm font-bold text-gray-600">Resolved</span>
                </div>
                <span className="text-lg font-black text-emerald-600">{tickets.filter(t => t.status === 'RESOLVED').length}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="font-black text-xl mb-2 tracking-tight">Need Urgent Help?</h4>
              <p className="text-blue-100 text-xs font-medium mb-6 leading-relaxed">Our support team is available 24/7 for critical platform issues.</p>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Internal Hotline</div>
              <div className="text-lg font-black tracking-tighter hover:scale-105 transition-transform origin-left cursor-pointer">+234 (0) 800-EDUNEXUS</div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
          </div>
        </div>

        {/* Tickets List Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="p-4 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <Search className="text-gray-400 ml-2" size={18} />
            <input 
              type="text" 
              placeholder="Filter by ID, subject or name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-gray-900 placeholder:text-gray-300"
            />
            <div className="w-px h-6 bg-gray-100 mx-2" />
            <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
              <Filter size={18} />
            </button>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white rounded-[2.5rem] border border-gray-100">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Retrieving Tickets...</div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center gap-6 bg-white rounded-[2.5rem] border border-gray-100 text-center px-12">
              <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-300">
                <MessageCircle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">No Tickets Found</h3>
                <p className="text-sm text-gray-400 font-medium max-w-sm">
                  {searchTerm ? "No tickets match your search criteria." : "There are currently no support requests to display."}
                </p>
              </div>
              {!searchTerm && !isSuper && (
                 <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-8 py-3 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500 rounded-xl hover:bg-gray-900 hover:text-white transition-all"
                 >
                  Submit Your First Ticket
                 </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pb-20">
              {filteredTickets.map((ticket) => (
                <motion.div 
                  layoutId={ticket.id}
                  key={ticket.id} 
                  onClick={() => setViewTicket(ticket)}
                  className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Send className="text-blue-600 -rotate-12" size={24} />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
                        {ticket.status?.replace('_', ' ')}
                      </div>
                      <span className="text-[10px] font-black text-blue-600 tracking-widest">#{ticket.ticketId}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-300" />
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xl font-black text-gray-900 mb-2 truncate pr-12 group-hover:text-blue-600 transition-colors tracking-tight">
                    {ticket.subject}
                  </h4>
                  <p className="text-sm text-gray-400 font-medium line-clamp-1 mb-6 leading-relaxed">
                    {ticket.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                       <Building size={14} className="text-gray-300" />
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{ticket.schoolName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Tag size={14} className="text-gray-300" />
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{ticket.category}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                       <div className={`w-2 h-2 rounded-full ${ticket.priority === 'URGENT' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{ticket.priority}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center">
                    <MessageCircle size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-gray-900 tracking-tight">Open Support Case</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Complaint Entry</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="p-10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Subject / Summary</label>
                    <input 
                      required 
                      type="text" 
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-gray-900"
                      placeholder="e.g., Result portal access issue"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Issue Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-gray-900 appearance-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Priority Level</label>
                    <div className="flex gap-2">
                      {PRIORITIES.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({ ...formData, priority: p })}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            formData.priority === p ? getPriorityColor(p) : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Detailed Description</label>
                  <textarea 
                    required 
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-gray-900 resize-none h-40"
                    placeholder="Describe your issue in detail..."
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-5 bg-gray-900 text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : (
                    <>
                      <span>Transmit Request</span>
                      <Send size={14} />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* View Ticket / Conversation Sidebar */}
        {viewTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setViewTicket(null)} 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="p-8 border-b border-gray-50 flex flex-col gap-6 bg-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">Ticket Case</span>
                    <h3 className="font-black text-xl text-gray-900 tracking-tight">#{viewTicket.ticketId}</h3>
                  </div>
                  <button onClick={() => setViewTicket(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                   {STATUSES.map(s => (
                     <button
                       key={s}
                       disabled={!isSuper}
                       onClick={() => handleUpdateStatus(viewTicket, s)}
                       className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all ${
                         viewTicket.status === s ? getStatusColor(s) + ' ring-1 ring-current' : 'bg-gray-50 text-gray-300 hover:bg-gray-100'
                       }`}
                     >
                       {s?.replace('_', ' ')}
                     </button>
                   ))}
                </div>
              </div>

              {/* Conversation Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30 scrollbar-hide">
                {/* Original Message */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-gray-200">
                    <Building size={16} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-900">{viewTicket.submittedByName}</span>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2 py-0.5 bg-gray-100 rounded-lg">Admin</span>
                      <span className="text-[9px] font-bold text-gray-400 ml-auto">{new Date(viewTicket.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="p-5 bg-white rounded-3xl rounded-tl-none border border-gray-100 shadow-sm text-sm text-gray-600 font-medium leading-relaxed">
                      <h4 className="font-black text-gray-900 mb-3 text-base">{viewTicket.subject}</h4>
                      {viewTicket.message}
                    </div>
                  </div>
                </div>

                {/* Responses */}
                {(viewTicket.replies || []).map((resp: any, i: number) => (
                  <div key={i} className={`flex gap-4 ${resp.sentByRole === 'SUPER_ADMIN' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      resp.sentByRole === 'SUPER_ADMIN' ? 'bg-blue-600 text-white shadow-blue-100' : 'bg-gray-900 text-white shadow-gray-200'
                    }`}>
                      {resp.sentByRole === 'SUPER_ADMIN' ? <ShieldAlert size={16} /> : <User size={16} />}
                    </div>
                    <div className={`flex-1 space-y-2 ${resp.sentByRole === 'SUPER_ADMIN' ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 ${resp.sentByRole === 'SUPER_ADMIN' ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-black text-gray-900">{resp.sentBy}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                          resp.sentByRole === 'SUPER_ADMIN' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {resp.sentByRole?.replace('_', ' ')}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 ml-auto">{resp.sentAt ? new Date(resp.sentAt).toLocaleString() : ''}</span>
                      </div>
                      <div className={`p-5 text-sm font-medium leading-relaxed border transition-all ${
                        resp.sentByRole === 'SUPER_ADMIN' 
                          ? 'bg-blue-600 text-white border-blue-500 rounded-3xl rounded-tr-none shadow-xl shadow-blue-100' 
                          : 'bg-white text-gray-600 border-gray-100 rounded-3xl rounded-tl-none shadow-sm'
                      }`}>
                        {resp.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Area */}
              <div className="p-8 border-t border-gray-50 bg-white shadow-2xl shrink-0">
                <div className="relative">
                  <textarea 
                    placeholder="Type your message to support..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={1}
                    className="w-full px-6 py-4 bg-gray-50 rounded-[2rem] border-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-sm text-gray-900 resize-none pr-16 max-h-40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <button 
                    disabled={!replyText.trim()}
                    onClick={handleSendReply}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 transition-all disabled:opacity-30 active:scale-90"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{toast.message}</span>
              <button 
                onClick={() => setToast(null)}
                className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
