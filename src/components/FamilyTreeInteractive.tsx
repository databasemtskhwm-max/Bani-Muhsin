import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, User, Heart, Flower2, X, Calendar, MapPin, Info } from 'lucide-react';
import { FamilyMember } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NodeProps {
  member: FamilyMember;
  level: number;
  isLast?: boolean;
}

const Node: React.FC<NodeProps> = ({ member, level, isLast }) => {
  // Always expand the root and the wives by default to show the 10 children
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [showDetails, setShowDetails] = useState(false);
  const hasChildren = member.children && member.children.length > 0;

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'ancestor': return 'bg-brand-olive text-white border-brand-olive shadow-md scale-105';
      case 'wife1': return 'bg-rose-50 text-rose-900 border-rose-200';
      case 'wife2': return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'spouse': return 'bg-rose-50 text-rose-900 border-rose-100 italic';
      case 'child': return 'bg-blue-50 text-blue-900 border-blue-100 hover:bg-blue-100';
      default: return 'bg-white text-brand-ink border-brand-olive/10 hover:bg-brand-cream';
    }
  };

  const getIcon = (type: string) => {
    if (member.photoUrl) {
      return (
        <div className="mr-3 w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden shadow-sm flex-shrink-0">
          <img 
            src={member.photoUrl} 
            alt={member.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://via.placeholder.com/100?text=" + member.name.charAt(0);
            }}
          />
        </div>
      );
    }
    if (type.startsWith('wife') || type === 'spouse') return <Heart size={14} className="mr-2 text-rose-400" />;
    return <User size={14} className="mr-2 opacity-70" />;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="relative ml-4 md:ml-10">
      {/* Vertical line connecting to parent */}
      {level > 0 && (
        <div className="absolute -left-4 md:-left-10 top-0 bottom-0 w-px bg-brand-olive/20">
          {isLast && <div className="absolute top-6 bottom-0 left-0 right-0 bg-brand-cream" />}
        </div>
      )}
      
      {/* Horizontal line connecting to parent */}
      {level > 0 && (
        <div className="absolute -left-4 md:-left-10 top-6 w-4 md:w-10 h-px bg-brand-olive/20" />
      )}

      <div className="py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(true)}
            className={cn(
              "flex items-center px-4 py-3 rounded-xl border transition-all duration-300 text-left min-w-[200px] group relative",
              getTypeStyles(member.type),
              "cursor-pointer hover:shadow-lg active:scale-95"
            )}
          >
            {getIcon(member.type)}
            <div className="flex-grow">
              <div className={cn(
                "font-semibold text-sm md:text-base flex items-center gap-2", 
                member.isDeceased && member.type !== 'ancestor' && "text-brand-olive/70",
                member.type === 'ancestor' && "text-white"
              )}>
                {member.name}
                {member.isDeceased && <Flower2 size={12} className={cn(member.type === 'ancestor' ? "text-white/60" : "text-brand-olive/40")} />}
              </div>
              <div className="flex flex-col">
                {member.spouse && <div className={cn("text-[10px] opacity-60 italic", member.type === 'ancestor' && "text-white/60")}>Pasangan: {member.spouse}</div>}
                {member.isDeceased ? (
                  <div className={cn("text-[9px] font-bold uppercase tracking-tighter", member.type === 'ancestor' ? "text-white/50" : "text-brand-olive/40")}>Almarhum/ah</div>
                ) : (
                  <div className={cn("text-[9px] font-bold uppercase tracking-tighter", member.type === 'ancestor' ? "text-white/50" : "text-emerald-600/40")}>Hidup</div>
                )}
              </div>
            </div>
            <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info size={14} />
            </div>
          </button>

          {hasChildren && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "p-2 rounded-full transition-all duration-300",
                member.type === 'ancestor' ? "text-white/60 hover:text-white hover:bg-white/10" : "text-brand-olive/50 hover:text-brand-olive hover:bg-brand-olive/5"
              )}
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
        </div>

        {/* Pulse effect for clickable nodes that are collapsed */}
        {hasChildren && !isExpanded && (
          <span className="absolute top-4 left-4 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-olive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-olive"></span>
          </span>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl max-w-md w-full relative border border-brand-olive/10"
            >
              <button 
                onClick={() => setShowDetails(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-brand-cream text-brand-ink/60 hover:text-brand-olive transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="h-48 bg-brand-olive/5 relative">
                {member.photoUrl ? (
                  <img 
                    src={member.photoUrl} 
                    alt={member.name} 
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
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-olive/20">
                      <User size={40} />
                    </div>
                  )}
                </div>

                <div className="text-center mb-8">
                  <h2 className="serif text-3xl font-light text-brand-ink mb-2">{member.name}</h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-brand-olive/10 text-[10px] font-bold uppercase tracking-wider text-brand-olive">
                      {member.type === 'ancestor' ? 'Leluhur' : member.type === 'spouse' ? 'Pasangan' : 'Keturunan'}
                    </span>
                    {member.isDeceased ? (
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
                      <p className="text-sm font-medium">{formatDate(member.birthDate) || 'Data tidak tersedia'}</p>
                    </div>
                  </div>

                  {member.isDeceased && member.deathDate && (
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                        <Flower2 size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Tanggal Wafat</p>
                        <p className="text-sm font-medium">{formatDate(member.deathDate)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-brand-olive/5 text-brand-olive">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Alamat Sekarang</p>
                      <p className="text-sm font-medium leading-relaxed">{member.address || 'Data tidak tersedia'}</p>
                    </div>
                  </div>

                  {member.spouse && (
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                        <Heart size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Pasangan</p>
                        <p className="text-sm font-medium">{member.spouse}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2">
              {member.children?.map((child, index) => (
                <Node 
                  key={child.id} 
                  member={child} 
                  level={level + 1} 
                  isLast={index === (member.children?.length || 0) - 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FamilyTreeInteractive: React.FC<{ data: FamilyMember | null }> = ({ data }) => {
  if (!data) return <div className="text-center p-10 opacity-50 italic">Memuat data silsilah...</div>;

  return (
    <div className="p-4 md:p-8 bg-white/30 rounded-3xl border border-brand-olive/5 shadow-inner overflow-x-auto">
      <div className="inline-block min-w-full">
        <Node member={data} level={0} isLast={true} />
      </div>
    </div>
  );
};
