import './styles/styles.css';
import { initDatabase } from './db/database.ts';
import { PlantView } from './views/plantView.ts';
import { PlantController } from './controllers/plantController.ts';

/**
 * Renders an accessible botanical loading screen while the WebAssembly SQLite engine boots.
 */
function showLoadingScreen(): void {
  const appElement = document.querySelector<HTMLElement>('#app');
  if (!appElement) return;

  appElement.innerHTML = `
    <div class="loading-screen" role="status" aria-live="polite">
      <div class="loading-card">
        <div class="loading-icon-wrap">
          <div class="loading-spinner" aria-hidden="true"></div>
          <span class="loading-logo" aria-hidden="true">🌱</span>
        </div>
        <h2 class="loading-title">Iniciando Huerto Urbano</h2>
        <p class="loading-desc">
          Cargando motor de base de datos SQLite con WebAssembly y restaurando tu jardín...
        </p>
      </div>
    </div>
  `;
}

/**
 * Displays a friendly error screen if SQLite WASM fails to load.
 */
function showErrorScreen(error: unknown): void {
  const appElement = document.querySelector<HTMLElement>('#app');
  if (!appElement) return;

  const errorMessage = error instanceof Error ? error.message : String(error);

  appElement.innerHTML = `
    <div class="error-screen" role="alert">
      <div class="error-card">
        <div class="error-icon" aria-hidden="true">⚠️</div>
        <h2 class="error-title">Error al inicializar la base de datos</h2>
        <p class="error-desc">
          No se pudo inicializar el motor SQLite WebAssembly o el almacenamiento local.<br />
          <strong>Detalle:</strong> ${errorMessage}
        </p>
        <button type="button" class="btn btn-primary" onclick="window.location.reload()">
          🔄 Reintentar
        </button>
      </div>
    </div>
  `;
}

/**
 * Main application entry point.
 */
async function bootstrap(): Promise<void> {
  showLoadingScreen();

  try {
    // Initialize SQLite WebAssembly engine and restore/seed database
    await initDatabase();

    // Create View & Controller instances and initialize app
    const view = new PlantView();
    const controller = new PlantController(view);
    controller.init();
  } catch (err) {
    console.error('Fatal initialization error:', err);
    showErrorScreen(err);
  }
}

// Bootstrap once DOM content is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
