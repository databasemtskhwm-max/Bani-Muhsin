export type MemberType = 'ancestor' | 'wife1' | 'wife2' | 'child' | 'descendant' | 'spouse';

export interface FamilyMember {
  id: string;
  name: string;
  type: MemberType;
  children?: FamilyMember[];
  spouse?: string;
  isDeceased?: boolean;
  photoUrl?: string;
  birthDate?: string;
  deathDate?: string;
  address?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  category: 'past' | 'upcoming';
  author: string;
  imageUrl?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
}

export interface GalleryItem {
  id: string;
  headOfFamilyId: string;
  headOfFamilyName: string;
  imageUrl: string;
  caption: string;
  date: string;
  uploadedBy: string;
}
