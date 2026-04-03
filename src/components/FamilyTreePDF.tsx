import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { FamilyMember } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#718096',
    textTransform: 'uppercase',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },
  statBox: {
    backgroundColor: '#F7FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  statLabel: {
    fontSize: 8,
    color: '#A0AEC0',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  treeContainer: {
    marginTop: 20,
  },
  memberCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
    width: '100%',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  statusBadge: {
    fontSize: 8,
    padding: 2,
    borderRadius: 4,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statusLiving: {
    backgroundColor: '#F0FDF4',
    color: '#166534',
  },
  statusDeceased: {
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
  },
  spouseInfo: {
    fontSize: 9,
    color: '#4A5568',
    marginTop: 2,
  },
  childCount: {
    fontSize: 8,
    color: '#718096',
    marginTop: 4,
  },
  indent: {
    marginLeft: 24,
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E0',
    paddingLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#A0AEC0',
  },
  pageNumber: {
    fontSize: 8,
    color: '#A0AEC0',
  },
});

interface FamilyTreePDFProps {
  rootMember: FamilyMember;
  maxDepth?: number;
}

const MemberNode = ({ member, depth, maxDepth }: { member: FamilyMember; depth: number; maxDepth?: number }) => {
  if (maxDepth !== undefined && depth > maxDepth) return null;

  const hasChildren = member.children && member.children.length > 0;

  return (
    <View style={depth > 0 ? styles.indent : {}}>
      <View style={styles.memberCard} wrap={false}>
        <View style={styles.memberHeader}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={[
            styles.statusBadge,
            member.isDeceased ? styles.statusDeceased : styles.statusLiving
          ]}>
            {member.isDeceased ? 'Almarhum/ah' : 'Hidup'}
          </Text>
        </View>
        
        {member.spouse && (
          <Text style={styles.spouseInfo}>
            Pasangan: {member.spouse} {member.spouseIsDeceased ? '(Alm/ah)' : ''}
          </Text>
        )}

        {hasChildren && (
          <Text style={styles.childCount}>
            {member.children?.length} Anak
          </Text>
        )}
      </View>

      {hasChildren && member.children?.map((child) => (
        <MemberNode 
          key={child.id} 
          member={child} 
          depth={depth + 1} 
          maxDepth={maxDepth} 
        />
      ))}
    </View>
  );
};

export const FamilyTreePDF = ({ rootMember, maxDepth }: FamilyTreePDFProps) => {
  const countMembers = (node: FamilyMember): number => {
    let count = 1;
    if (node.children) {
      node.children.forEach(child => {
        count += countMembers(child);
      });
    }
    return count;
  };

  const getMaxGenerations = (node: FamilyMember): number => {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getMaxGenerations));
  };

  const totalMembers = countMembers(rootMember);
  const totalGenerations = getMaxGenerations(rootMember);
  const generateDate = new Date().toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Silsilah Keturunan {rootMember.name}</Text>
          <Text style={styles.subtitle}>Dicetak pada {generateDate}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Anggota</Text>
              <Text style={styles.statValue}>{totalMembers}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Generasi</Text>
              <Text style={styles.statValue}>{totalGenerations}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Tokoh Utama</Text>
              <Text style={styles.statValue}>{rootMember.name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.treeContainer}>
          <MemberNode member={rootMember} depth={0} maxDepth={maxDepth} />
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Keluarga Besar Bani Muhsin • Silsilah Digital</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `Halaman ${pageNumber} dari ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  );
};
