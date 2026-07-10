import { useState } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { calculateElo, getNextMatch, getTargetMatchesPerItem } from './eloUtils'; // Importeer de dynamische target functie
import { SorterResultsView } from './SorterResultsView';
import styles from './Sorter.module.css';

interface SorterViewProps {
  theme: Theme;
  initialPool: EloExtended<HydratedEntity>[];
}

export function SorterView({ theme, initialPool }: SorterViewProps) {
  // tournamentList: Beheert de actieve lijst van alle deelnemende items en hun actuele ELO-scores.
  const [tournamentList, setTournamentList] = useState<EloExtended<HydratedEntity>[]>(initialPool);

  // currentMatchup: Bevat het huidige duo dat nu tegen elkaar strijdt.
  const [currentMatchup, setCurrentMatchup] = useState<[EloExtended<HydratedEntity>, EloExtended<HydratedEntity>] | null>(() => 
    getNextMatch(initialPool)
  );

  // Aantal uitgebrachte stemmen/keuzes tijdens deze sessie.
  const [voteCount, setVoteCount] = useState<number>(0);

  // Indexhouders voor de carrousels om horizontaal door de afbeeldingen/video's te bladeren.
  const [leftMediaIndex, setLeftMediaIndex] = useState<number>(0);
  const [rightMediaIndex, setRightMediaIndex] = useState<number>(0);

  // Verzamelt alle bruikbare media URL's van een item.
  const extractMediaUrls = (entity: HydratedEntity): string[] => {
    const discoveredUrls: string[] = [];

    if (entity.image?.profileCard) {
      discoveredUrls.push(entity.image.profileCard.trim());
    }
    if (entity.image?.heroBanner) {
      discoveredUrls.push(entity.image.heroBanner.trim());
    }

    const layerMetadata = theme.layerMetadata[entity.type];
    if (layerMetadata && layerMetadata.mediaKeys) {
      layerMetadata.mediaKeys.forEach(key => {
        if (key === 'profileCard' || key === 'heroBanner') return;

        const dynamicMediaData = entity.image[key];
        if (typeof dynamicMediaData === 'string') {
          discoveredUrls.push(...dynamicMediaData.split(' ').map(url => url.trim()).filter(Boolean));
        } else if (Array.isArray(dynamicMediaData)) {
          discoveredUrls.push(...dynamicMediaData.filter((url): url is string => typeof url === 'string').map(url => url.trim()));
        }
      });
    }

    return discoveredUrls;
  };

  // CHECK: Als de matchup null is, stuurt eloUtils ons door naar het resultatenscherm.
  if (!currentMatchup) {
    return (
      <SorterResultsView 
        theme={theme}
        finalPool={tournamentList}
        extractMediaUrls={extractMediaUrls}
        onRestart={() => window.location.reload()}
      />
    );
  }

  const [leftItem, rightItem] = currentMatchup;
  const leftItemMedia: string[] = extractMediaUrls(leftItem);
  const rightItemMedia: string[] = extractMediaUrls(rightItem);

  // OPGELOST: Gebruik de dynamische targetMatches in plaats van het hardcoded getal 15!
  const targetMatchesPerItem = getTargetMatchesPerItem(tournamentList.length);
  const totalMatchesPlayedAcrossPool: number = tournamentList.reduce((sum, item) => sum + item.matchesPlayed, 0);
  const averageMatchesPlayed: number = totalMatchesPlayedAcrossPool / tournamentList.length;
  const calibrationProgress: number = Math.min(Math.round((averageMatchesPlayed / targetMatchesPerItem) * 100), 100);

  // Verwerkt de klik van de gebruiker op de winnaar.
  const handleProcessVote = (winner: 'A' | 'B'): void => {
    const { newRatingA, newRatingB } = calculateElo(leftItem.elo, rightItem.elo, winner);

    const updatedList = tournamentList.map(item => {
      if (item.id === leftItem.id) return { ...item, elo: newRatingA, matchesPlayed: item.matchesPlayed + 1 };
      if (item.id === rightItem.id) return { ...item, elo: newRatingB, matchesPlayed: item.matchesPlayed + 1 };
      return item;
    });

    setTournamentList(updatedList);
    setVoteCount(prev => prev + 1);
    setCurrentMatchup(getNextMatch(updatedList));

    // Reset de carrousel-indexen terug naar de eerste afbeelding voor de volgende ronde.
    setLeftMediaIndex(0);
    setRightMediaIndex(0);
  };

  // Genereert de juiste HTML-component op basis van het bestandstype.
  const renderMediaComponent = (url: string): React.JSX.Element => {
    if (!url) {
      return <div className={styles.mediaWrapper}>No media</div>;
    }

    const isVideoFile: boolean = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('mp4');

    if (isVideoFile) {
      return (
        <video src={url} autoPlay loop muted playsInline className={styles.mediaAsset} />
      );
    }
    return (
      <img src={url} alt="Sorter choice asset" className={styles.mediaAsset} />
    );
  };

  // Haalt de naam van de bovenliggende groep op om te tonen als ondertitel.
  const getItemSubtitle = (entity: HydratedEntity): string => {
    const parentConnection = entity.targetConnections?.find(conn => conn.sourceEntity?.type === theme.orgLayer);
    return parentConnection?.sourceEntity?.name || '';
  };

  return (
    <div className={styles.sorterContainer}>

      {/* LINKER KANDIDAAT PANEEL */}
      <div className={styles.mediaColumn} onClick={() => handleProcessVote('A')}>
        {renderMediaComponent(leftItemMedia[leftMediaIndex])}
        <div className={`${styles.entityCard} ${styles.entityCardLeft}`}>
          <h3 className={styles.entityName}>{leftItem.name}</h3>
          <p className={styles.entitySubtitle}>{getItemSubtitle(leftItem)}</p>
        </div>
      </div>

      {/* MIDDENSECTIE (CONSOLE & PROGRESS) */}
      <div className={styles.centerColumn}>
        <div className={styles.headerZone}>
          <h2 className={styles.matchTitle}>Vote #{voteCount + 1}</h2>

          <div className={styles.progressContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${calibrationProgress}%` }}
            />
          </div>
          <p className={styles.progressLabel}>
            Pool Calibration: {calibrationProgress}%
          </p>
        </div>

        {/* Media Carrousel Knoppen */}
        <div className={styles.controlZone}>
          <div className={styles.carouselControls}>
            <span className={styles.controlLabel}>Left Assets</span>
            <button
              disabled={leftMediaIndex === 0}
              onClick={(e) => { e.stopPropagation(); setLeftMediaIndex(prev => prev - 1); }}
              className={styles.arrowButton}
            >
              ▲
            </button>
            <button
              disabled={leftMediaIndex >= leftItemMedia.length - 1}
              onClick={(e) => { e.stopPropagation(); setLeftMediaIndex(prev => prev + 1); }}
              className={styles.arrowButton}
            >
              ▼
            </button>
          </div>

          <div className={styles.vsBadge}>VS</div>

          <div className={styles.carouselControls}>
            <span className={styles.controlLabel}>Right Assets</span>
            <button
              disabled={rightMediaIndex === 0}
              onClick={(e) => { e.stopPropagation(); setRightMediaIndex(prev => prev - 1); }}
              className={styles.arrowButton}
            >
              ▲
            </button>
            <button
              disabled={rightMediaIndex >= rightItemMedia.length - 1}
              onClick={(e) => { e.stopPropagation(); setRightMediaIndex(prev => prev + 1); }}
              className={styles.arrowButton}
            >
              ▼
            </button>
          </div>
        </div>

        {/* Live Top 3 Tussenstand */}
        <div className={styles.leaderboardZone}>
          <h4 className={styles.leaderboardTitle}>Current Top 3</h4>
          <ol className={styles.leaderboardList}>
            {[...tournamentList].sort((a, b) => b.elo - a.elo).slice(0, 3).map((item) => (
              <li key={item.id} className={styles.leaderboardItem}>
                <strong>{item.name}</strong>
                <span className={styles.leaderboardScore}>({item.elo})</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* RECHTER KANDIDAAT PANEEL */}
      <div className={styles.mediaColumn} onClick={() => handleProcessVote('B')}>
        {renderMediaComponent(rightItemMedia[rightMediaIndex])}
        <div className={`${styles.entityCard} ${styles.entityCardRight}`}>
          <h3 className={styles.entityName}>{rightItem.name}</h3>
          <p className={styles.entitySubtitle}>{getItemSubtitle(rightItem)}</p>
        </div>
      </div>

    </div>
  );
}