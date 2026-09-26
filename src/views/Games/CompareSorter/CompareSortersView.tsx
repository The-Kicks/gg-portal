import { useState, useEffect, useMemo } from 'react';
import type { Theme } from '../../../types';
import styles from '../Sorter/SorterCSS/SorterResults.module.css';

interface UserStorageObject {
  id?: string;
  _id?: string;
}

const getStoredUserId = (): string => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr) as UserStorageObject;
      return userObj.id || userObj._id || localStorage.getItem('userId') || '';
    } catch (err: unknown) {
      console.error("Fout bij uitlezen userId uit JSON:", err);
    }
  }
  return localStorage.getItem('userId') || '';
};

interface RankedItem {
  id: string;
  name: string;
  elo: number;
  rank: number;
}

interface SavedSorterItem {
  id: string;
  name: string;
  themeId: string;
  createdAt: string;
  data: {
    rankedItems: RankedItem[];
  };
}

// Interface voor opgeslagen vriend-profielen (pas aan indien je datatructuur anders heet)
interface FriendProfileItem {
  id: string;
  name: string; // Naam van de vriend
  data: {
    friendUserId: string; // Het userID van de vriend dat hierin is opgeslagen
  };
}

interface ComparisonRow {
  id: string;
  name: string;
  myRank: number;
  myElo: number;
  friendRank: number | null;
  friendElo: number | null;
  rankDiff: number | null;
}

interface CompareSortersViewProps {
  theme: Theme;
  onBack?: () => void;
}

export function CompareSortersView({ theme, onBack }: CompareSortersViewProps) {
  const [mySorters, setMySorters] = useState<SavedSorterItem[]>([]);
  const [selectedMyId, setSelectedMyId] = useState<string>('');

  // Geïmporteerde vrienden state
  const [friendProfiles, setFriendProfiles] = useState<FriendProfileItem[]>([]);
  const [selectedFriendProfileId, setSelectedFriendProfileId] = useState<string>('');
  
  const [friendSorters, setFriendSorters] = useState<SavedSorterItem[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('');

  const [loadingMy, setLoadingMy] = useState<boolean>(false);
  const [loadingFriendsList, setLoadingFriendsList] = useState<boolean>(false);
  const [loadingFriendSorters, setLoadingFriendSorters] = useState<boolean>(false);

  const currentUserId = getStoredUserId();

  // 1. Laad eigen sorters én geïmporteerde vrienden bij het openen
  useEffect(() => {
    if (!currentUserId || !theme?.id) return;

    const fetchData = async () => {
      try {
        setLoadingMy(true);
        setLoadingFriendsList(true);

        // A. Haal eigen sorters op
        const myRes = await fetch(`/api/saved-items?userId=${currentUserId}&type=sorter_finished&themeId=${theme.id}`);
        if (myRes.ok) {
          const items: SavedSorterItem[] = await myRes.json();
          setMySorters(items);
          if (items.length > 0) setSelectedMyId(items[0].id);
        }

        // B. Haal geïmporteerde vrienden op (pas 'type=friend_profile' aan als jouw backend type anders is, bijv. 'friend')
        const friendsRes = await fetch(`/api/saved-items?userId=${currentUserId}&type=friend_profile`);
        if (friendsRes.ok) {
          const profiles: FriendProfileItem[] = await friendsRes.json();
          setFriendProfiles(profiles);
          if (profiles.length > 0) {
            setSelectedFriendProfileId(profiles[0].id);
          }
        }
      } catch (err) {
        console.error("Fout bij ophalen initiële data:", err);
      } finally {
        setLoadingMy(false);
        setLoadingFriendsList(false);
      }
    };

    fetchData();
  }, [currentUserId, theme.id]);

  // Hulpstuk om de actieve vriend op te zoeken op basis van de geselecteerde dropdown
  const activeFriendProfile = friendProfiles.find(fp => fp.id === selectedFriendProfileId);

  // 2. Automatisch vriend sorters ophalen zodra een vriend-profiel wordt geselecteerd
  useEffect(() => {
    const fetchFriendSorters = async () => {
      if (!activeFriendProfile || !activeFriendProfile.data?.friendUserId) {
        setFriendSorters([]);
        return;
      }

      const friendUserId = activeFriendProfile.data.friendUserId;

      try {
        setLoadingFriendSorters(true);
        const res = await fetch(`/api/saved-items?userId=${friendUserId}&type=sorter_finished&themeId=${theme.id}`);
        
        if (res.ok) {
          const items: SavedSorterItem[] = await res.json();
          setFriendSorters(items);
          if (items.length > 0) {
            setSelectedFriendId(items[0].id);
          } else {
            setSelectedFriendId('');
          }
        } else {
          setFriendSorters([]);
        }
      } catch (err) {
        console.error("Fout bij ophalen vriend sorters:", err);
        setFriendSorters([]);
      } finally {
        setLoadingFriendSorters(false);
      }
    };

    fetchFriendSorters();
  }, [activeFriendProfile, theme.id]);

  // Geselecteerde sorter objecten
  const mySelectedSorter = mySorters.find(s => s.id === selectedMyId);
  const friendSelectedSorter = friendSorters.find(s => s.id === selectedFriendId);

  // Combineer data voor de vergelijkingstabel
  const comparisonData = useMemo<ComparisonRow[]>(() => {
    if (!mySelectedSorter) return [];

    const myMap = new Map<string, RankedItem>();
    mySelectedSorter.data.rankedItems.forEach(item => myMap.set(item.id, item));

    const friendMap = new Map<string, RankedItem>();
    if (friendSelectedSorter) {
      friendSelectedSorter.data.rankedItems.forEach(item => friendMap.set(item.id, item));
    }

    return mySelectedSorter.data.rankedItems.map(myItem => {
      const friendItem = friendMap.get(myItem.id);
      const myRank = myItem.rank;
      const friendRank = friendItem ? friendItem.rank : null;
      const rankDiff = friendRank !== null ? friendRank - myRank : null;

      return {
        id: myItem.id,
        name: myItem.name,
        myRank,
        myElo: myItem.elo,
        friendRank,
        friendElo: friendItem ? friendItem.elo : null,
        rankDiff
      };
    }).sort((a, b) => a.myRank - b.myRank);
  }, [mySelectedSorter, friendSelectedSorter]);

  return (
    <div className={styles.resultsContainer} style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Sorter Comparator</h2>
        <p className={styles.resultsSubtitle}>Vergelijk jouw rankings met die van je vrienden voor {theme.title}</p>
      </div>

      {/* Selectie Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '2rem 0', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
        
        {/* Kolom 1: Mijn Sorter */}
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Jouw Opgeslagen Sorter</h3>
          {loadingMy ? (
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>Laden...</p>
          ) : mySorters.length === 0 ? (
            <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>Geen opgeslagen sorters gevonden voor dit thema.</p>
          ) : (
            <select
              value={selectedMyId}
              onChange={(e) => setSelectedMyId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {mySorters.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({new Date(s.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Kolom 2: Vriend Sorter (Automatisch via geïmporteerde vrienden) */}
        <div>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Selecteer Vriend</h3>
          {loadingFriendsList ? (
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>Vrienden laden...</p>
          ) : friendProfiles.length === 0 ? (
            <p style={{ color: '#eab308', fontSize: '0.9rem' }}>Geen geïmporteerde vrienden gevonden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select
                value={selectedFriendProfileId}
                onChange={(e) => setSelectedFriendProfileId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {friendProfiles.map(fp => (
                  <option key={fp.id} value={fp.id}>
                    {fp.name || 'Naamloze Vriend'}
                  </option>
                ))}
              </select>

              {loadingFriendSorters ? (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Sorters van vriend ophalen...</p>
              ) : friendSorters.length > 0 ? (
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSelectedFriendId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {friendSorters.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({new Date(s.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Geen sorters gevonden voor deze vriend bij dit thema.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vergelijkingstabel */}
      {mySelectedSorter ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 16px' }}>Item</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Jouw Rank (Elo)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Vriend Rank (Elo)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Verschil</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row: ComparisonRow) => {
                let diffColor = '#a1a1aa';
                let diffText = '-';

                if (row.friendRank !== null && row.rankDiff !== null) {
                  if (row.rankDiff < 0) {
                    diffColor = '#22c55e'; // Vriend vindt dit hoger
                    diffText = `▲ ${Math.abs(row.rankDiff)}`;
                  } else if (row.rankDiff > 0) {
                    diffColor = '#ef4444'; // Vriend vindt dit lager
                    diffText = `▼ ${row.rankDiff}`;
                  } else {
                    diffText = '= Gelijk';
                  }
                }

                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{row.name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ background: '#3b82f6', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', marginRight: '8px' }}>#{row.myRank}</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>({Math.round(row.myElo)})</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {row.friendRank !== null && row.friendElo !== null ? (
                        <>
                          <span style={{ background: '#8b5cf6', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', marginRight: '8px' }}>#{row.friendRank}</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>({Math.round(row.friendElo)})</span>
                        </>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Niet beschikbaar</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: diffColor }}>
                      {diffText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.6)' }}>
          Selecteer een eigen sorter om de vergelijking te starten.
        </div>
      )}

      {onBack && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button onClick={onBack} className={styles.startButton} style={{ marginTop: 0, background: '#27272a' }}>
            Terug naar Sorter
          </button>
        </div>
      )}
    </div>
  );
}