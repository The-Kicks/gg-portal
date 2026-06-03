import type { Theme } from '../../types';
import styles from './Home.module.css';
import { PortalCard } from "../../core/components/UI/PortalCard/PortalCard.tsx";
import { PortalGroup } from '../../core/components/UI/PortalCard/PortalGroup.tsx';

interface HomeProps {
  theme: Theme;
  isDark: boolean;
}

/**
 * Home component acts as the main hub landing page for the selected theme platform portal.
 * It features a centralized header and dynamically lists available active modules/games 
 * within a responsive layout deck using custom theme background blending states.
 */
const Home = ({ theme, isDark }: HomeProps) => {
  const numGames = theme.games.length;

  // DYNAMIC SIZING ENGINE: Calculates proportional percentage column widths based on total elements count
  // 1 game -> 100% width, 2 games -> 50% width each, 3+ games -> 33% width grid splits
  const calculatedSize = numGames === 1 ? 100 : numGames === 2 ? 50 : 33;

  // COLOR BLENDING LIFECYCLE: Standardizes contextual panel backing tokens.
  // Blends the master css backgrounds variable natively against white hues depending on active dark/light mode states.
  const cardBg = isDark
    ? 'color-mix(in srgb, var(--bg), white 5%)'
    : 'color-mix(in srgb, var(--bg), white 40%)';

  return (
    <main>
      {/* PORTAL CORE PLATFORM INTRO DISPLAY HEADER */}
      <header className={styles.appHeader}>
        <h1>{theme.title}</h1>
        <p>{theme.description}</p>
      </header>

      {/* GAME MODULE DISPATCHER SECTION GRID */}
      <section className={styles.gamesList}>
        <PortalGroup title="Kies je spel:" customBg={cardBg}>

          <div className={styles.cardContainer}>
            {theme.games.map((game) => (
              <PortalCard
                key={`${theme.id}-${game}`}
                size={calculatedSize}
                spotlight={true} // Triggers mouse tracker radial hover lighting illumination shaders
                customBg={cardBg}
                onClick={() => console.log(`Selected game route path: ${game}`)}
              >
                {/* Upper-cases text strings values globally to preserve racing dashboard visual guidelines */}
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