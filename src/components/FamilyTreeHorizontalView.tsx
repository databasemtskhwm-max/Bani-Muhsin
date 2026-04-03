import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronDown, User, Heart, Flower2, X, Calendar, MapPin, Info, Users, Download, FileText, Check } from 'lucide-react';
import { FamilyMember } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { FamilyTreePDF } from './FamilyTreePDF';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FamilyTreeHorizontalViewProps {
  rootMember: FamilyMember;
  onClose: () => void;
}

const MemberCard: React.FC<{ 
  member: FamilyMember; 
  isExpanded: boolean; 
  onToggleExpand: () => void;
  onShowDetails: (member: FamilyMember) => void;
}> = ({ member, isExpanded, onToggleExpand, onShowDetails }) => {
  const hasChildren = member.children && member.children.length > 0;
  
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'ancestor': return 'bg-brand-olive text-white border-brand-olive shadow-lg scale-105';
      case 'wife1': return 'bg-rose-50 text-rose-900 border-rose-200';
      case 'wife2': return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'spouse': return 'bg-rose-50 text-rose-900 border-rose-100 italic';
      case 'child': return 'bg-blue-50 text-blue-900 border-blue-100 hover:bg-blue-100';
      default: return 'bg-white text-brand-ink border-brand-olive/10 hover:bg-brand-cream';
    }
  };

  return (
    <div className="relative flex items-center">
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center p-4 rounded-2xl border shadow-sm transition-all duration-300 min-w-[240px] max-w-[280px] group relative z-10",
          getTypeStyles(member.type),
          "cursor-pointer hover:shadow-xl hover:-translate-y-1"
        )}
        onClick={() => onShowDetails(member)}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="relative flex-shrink-0">
            {member.photoUrl ? (
              <div className="w-12 h-12 rounded-full border-2 border-white/50 overflow-hidden shadow-sm">
                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive/40 border-2 border-white/50">
                <User size={24} />
              </div>
            )}
            {member.isDeceased && (
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                <Flower2 size={12} className="text-brand-olive/60" />
              </div>
            )}
          </div>
          
          <div className="flex-grow min-w-0">
            <h3 className={cn(
              "font-bold text-sm truncate",
              member.type === 'ancestor' ? "text-white" : "text-brand-ink"
            )}>
              {member.name}
            </h3>
            <div className="flex flex-col gap-0.5">
              {member.spouse && (
                <p className={cn(
                  "text-[10px] truncate opacity-70 italic flex items-center gap-1",
                  member.type === 'ancestor' ? "text-white/70" : "text-brand-ink/70"
                )}>
                  <Heart size={8} className="text-rose-400" /> {member.spouse}
                </p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className={cn(
                  "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                  member.isDeceased 
                    ? (member.type === 'ancestor' ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700")
                    : (member.type === 'ancestor' ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700")
                )}>
                  {member.isDeceased ? 'Almarhum/ah' : 'Hidup'}
                </span>
                {hasChildren && (
                  <span className={cn(
                    "text-[8px] font-bold flex items-center gap-1 opacity-60",
                    member.type === 'ancestor' ? "text-white" : "text-brand-ink"
                  )}>
                    <Users size={8} /> {member.children?.length} Anak
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Info size={12} className={member.type === 'ancestor' ? "text-white/60" : "text-brand-ink/40"} />
        </div>
      </motion.div>

      {hasChildren && (
        <div className="flex items-center">
          <div className="w-8 h-px bg-brand-olive/20" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center border border-brand-olive/20 bg-white text-brand-olive hover:bg-brand-olive hover:text-white transition-all shadow-sm z-20",
              isExpanded && "bg-brand-olive text-white"
            )}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
};

const HorizontalNode: React.FC<{ 
  member: FamilyMember; 
  onShowDetails: (member: FamilyMember) => void;
}> = ({ member, onShowDetails }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = member.children && member.children.length > 0;

  return (
    <div className="flex items-start">
      <div className="flex flex-col items-center">
        <MemberCard 
          member={member} 
          isExpanded={isExpanded} 
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onShowDetails={onShowDetails}
        />
      </div>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex flex-col gap-6 ml-8 relative"
          >
            {/* Vertical connector line for children */}
            {member.children!.length > 1 && (
              <div className="absolute -left-8 top-6 bottom-6 w-px bg-brand-olive/20" />
            )}
            
            {member.children!.map((child, index) => (
              <div key={child.id} className="relative flex items-center">
                {/* Horizontal connector line from parent's vertical line */}
                <div className="absolute -left-8 top-6 w-8 h-px bg-brand-olive/20" />
                <HorizontalNode member={child} onShowDetails={onShowDetails} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FamilyTreeHorizontalView: React.FC<FamilyTreeHorizontalViewProps> = ({ rootMember, onClose }) => {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number>(99); // Default to all
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-brand-cream/95 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-brand-olive/10 flex justify-between items-center bg-white/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-olive/10 rounded-2xl text-brand-olive">
            <Users size={24} />
          </div>
          <div>
            <h2 className="serif text-2xl font-bold text-brand-ink">Fokus Keturunan: {rootMember.name}</h2>
            <p className="text-xs text-brand-ink/60 italic">Menampilkan seluruh garis keturunan secara horizontal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDownloadOptions(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-olive text-white font-bold hover:shadow-xl hover:scale-105 transition-all active:scale-95"
          >
            <Download size={18} />
            Unduh PDF
          </button>
          <button 
            onClick={onClose}
            className="p-3 rounded-full bg-white border border-brand-olive/10 text-brand-ink/60 hover:text-brand-olive hover:shadow-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Tree Container */}
      <div 
        ref={containerRef}
        className="flex-grow overflow-auto p-12 md:p-20 cursor-grab active:cursor-grabbing"
      >
        <div className="inline-block min-w-full">
          <HorizontalNode member={rootMember} onShowDetails={setSelectedMember} />
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-white/50 border-t border-brand-olive/10 text-center text-[10px] text-brand-ink/40 uppercase tracking-widest">
        Gunakan scroll horizontal untuk melihat lebih banyak • Klik kartu untuk detail
      </div>

      {/* Download Options Modal */}
      <AnimatePresence>
        {showDownloadOptions && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl max-w-md w-full relative border border-brand-olive/10 p-8"
            >
              <button 
                onClick={() => setShowDownloadOptions(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-brand-cream text-brand-ink/60 hover:text-brand-olive transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-brand-olive/10 rounded-2xl text-brand-olive">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="serif text-2xl font-bold text-brand-ink">Opsi Unduhan PDF</h3>
                  <p className="text-xs text-brand-ink/60">Sesuaikan tampilan silsilah Anda</p>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-3">Kedalaman Generasi</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Hanya Anak', value: 1 },
                      { label: 'Sampai Cucu', value: 2 },
                      { label: 'Sampai Cicit', value: 3 },
                      { label: 'Semua', value: 99 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMaxDepth(opt.value)}
                        className={cn(
                          "px-4 py-3 rounded-2xl border text-sm font-medium transition-all flex items-center justify-between",
                          maxDepth === opt.value 
                            ? "bg-brand-olive text-white border-brand-olive shadow-md" 
                            : "bg-brand-cream/30 border-brand-olive/10 text-brand-ink hover:bg-brand-cream"
                        )}
                      >
                        {opt.label}
                        {maxDepth === opt.value && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-brand-olive/5 border border-brand-olive/10">
                  <p className="text-[10px] text-brand-olive font-medium leading-relaxed">
                    PDF akan digenerate dengan layout vertikal bertingkat yang rapi untuk memastikan semua data terbaca dengan jelas saat dicetak.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDownloadOptions(false)}
                  className="flex-grow py-4 rounded-full border border-brand-olive/10 text-brand-ink font-bold hover:bg-brand-cream transition-all"
                >
                  Batal
                </button>
                <PDFDownloadLink
                  document={<FamilyTreePDF rootMember={rootMember} maxDepth={maxDepth} />}
                  fileName={`Silsilah_${rootMember.name.replace(/\s+/g, '_')}.pdf`}
                  className="flex-grow"
                >
                  {({ loading }) => (
                    <button
                      disabled={loading}
                      onClick={() => setTimeout(() => setShowDownloadOptions(false), 1000)}
                      className="w-full py-4 rounded-full bg-brand-olive text-white font-bold hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Menyiapkan...' : (
                        <>
                          <Download size={18} />
                          Unduh Sekarang
                        </>
                      )}
                    </button>
                  )}
                </PDFDownloadLink>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl max-w-md w-full relative border border-brand-olive/10"
            >
              <button 
                onClick={() => setSelectedMember(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-brand-cream text-brand-ink/60 hover:text-brand-olive transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="h-48 bg-brand-olive/5 relative">
                {selectedMember.photoUrl ? (
                  <img 
                    src={selectedMember.photoUrl} 
                    alt={selectedMember.name} 
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-olive/20">
                    <User size={80} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
              </div>

              <div className="px-8 pb-10 -mt-12 relative">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-brand-cream mb-6 mx-auto">
                  {selectedMember.photoUrl ? (
                    <img src={selectedMember.photoUrl} alt={selectedMember.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-olive/20">
                      <User size={40} />
                    </div>
                  )}
                </div>

                <div className="text-center mb-8">
                  <h2 className="serif text-3xl font-light text-brand-ink mb-2">{selectedMember.name}</h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-brand-olive/10 text-[10px] font-bold uppercase tracking-wider text-brand-olive">
                      {selectedMember.type === 'ancestor' ? 'Leluhur' : selectedMember.type === 'spouse' ? 'Pasangan' : 'Keturunan'}
                    </span>
                    {selectedMember.isDeceased ? (
                      <span className="px-3 py-1 rounded-full bg-rose-50 text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                        <Flower2 size={10} /> Almarhum/ah
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Hidup
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-brand-olive/5 text-brand-olive">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Tanggal Lahir</p>
                      <p className="text-sm font-medium">{formatDate(selectedMember.birthDate) || 'Data tidak tersedia'}</p>
                    </div>
                  </div>

                  {selectedMember.isDeceased && selectedMember.deathDate && (
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                        <Flower2 size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Tanggal Wafat</p>
                        <p className="text-sm font-medium">{formatDate(selectedMember.deathDate)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-brand-olive/5 text-brand-olive">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Alamat Sekarang</p>
                      <p className="text-sm font-medium leading-relaxed">{selectedMember.address || 'Data tidak tersedia'}</p>
                    </div>
                  </div>

                  {selectedMember.spouse && (
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                        <Heart size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Pasangan</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{selectedMember.spouse}</p>
                          {selectedMember.spouseIsDeceased && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-[8px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                              <Flower2 size={8} /> Alm/ah
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
