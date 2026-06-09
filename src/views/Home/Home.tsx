import type { Theme } from '../../types';
import styles from './Home.module.css';
import { PortalCard } from "../../core/components/UI/PortalCard/PortalCard.tsx";
import { PortalGroup } from '../../core/components/UI/PortalCard/PortalGroup.tsx';
// 🌟 Importeer useNavigate
import { useNavigate } from 'react-router-dom';

interface HomeProps {
  theme: Theme;
  isDark: boolean;
}

const Home = ({ theme, isDark }: HomeProps) => {
  // 🌟 Activeer de navigator
  const navigate = useNavigate();
  const numGames = theme.games.length;

  const calculatedSize = numGames === 1 ? 100 : numGames === 2 ? 50 : 33;

  const cardBg = isDark
    ? 'color-mix(in srgb, var(--bg), white 5%)'
    : 'color-mix(in srgb, var(--bg), white 40%)';

  return (
    <main>
      <header className={styles.appHeader}>
        <h1>{theme.title}</h1>
        <p>{theme.description}</p>
      </header>

      <section className={styles.gamesList}>
        <PortalGroup title="Kies je spel:" customBg={cardBg}>

          <div className={styles.cardContainer}>
            {theme.games.map((game) => (
              <PortalCard
                key={`${theme.id}-${game}`}
                size={calculatedSize}
                spotlight={true}
                customBg={cardBg}
                onClick={() => navigate(`/${theme.id}/${game.toLowerCase()}`)}
              >
                <span className={styles.gameTitle}>{game.toUpperCase()}</span>
              </PortalCard>
            ))}
          </div>

        </PortalGroup>
      </section>
    </main>
  );
};

export default Home;