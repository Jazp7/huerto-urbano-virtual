import '../styles/styles.css';
import type { EstadoRiego, Planta, Riego, SaludPlanta } from '../models/types.ts';

/**
 * Escapes HTML characters to prevent XSS vulnerabilities in user-provided content.
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class PlantView {
  private appElement: HTMLElement | null = null;
  private currentHistoryPlanta: Planta | null = null;
  private currentEditingId: number | null = null;
  private selectedEmoji: string = '🌱';

  // Available emojis for the visual picker
  private readonly emojiList: string[] = [
    '🌱', '🍅', '🌿', '🌵', '🍓', '🥕', '🌻', '🌶️', '🍋', '🪻', '🌸', '🪴', '🥬', '🥦', '🌾', '🍄'
  ];

  // Callback handlers
  private waterPlantHandler?: (id: number) => void;
  private editPlantHandler?: (id: number) => void;
  private deletePlantHandler?: (id: number) => void;
  private viewHistoryHandler?: (id: number) => void;
  private submitPlantHandler?: (data: Omit<Planta, 'id' | 'creada_en'>, id?: number) => void;
  private submitWateringHandler?: (plantaId: number, cantidadMl: number, obs: string) => void;
  private deleteWateringHandler?: (riegoId: number, plantaId: number) => void;
  private searchHandler?: (query: string) => void;
  private filterChangeHandler?: (filter: 'todas' | 'sedientas' | 'hidratadas') => void;
  private resetDemoHandler?: () => void;

  /**
   * Initializes and renders the core layout skeleton into the `#app` container.
   */
  public renderAppSkeleton(): void {
    this.appElement = document.querySelector<HTMLElement>('#app');
    if (!this.appElement) {
      console.error('Root element #app not found');
      return;
    }

    this.appElement.innerHTML = `
      <div class="app-container">
        <!-- Header -->
        <header class="app-header">
          <div class="header-top">
            <div class="brand-section">
              <div class="brand-logo" aria-hidden="true">🌱</div>
              <div>
                <h1 class="brand-title">
                  Huerto Urbano Virtual
                  <span class="brand-badge">SQLite WASM</span>
                </h1>
                <p class="brand-subtitle">Simulador de cultivo y control de riegos con SQLite</p>
              </div>
            </div>
            <div class="header-actions">
              <button type="button" class="btn btn-secondary" id="btn-reset-demo" title="Restablecer base de datos inicial con plantas y riegos de demostración">
                🔄 Restablecer Demo
              </button>
            </div>
          </div>

          <!-- Stats Bar -->
          <div class="stats-bar" aria-label="Estadísticas generales del huerto">
            <div class="stat-card">
              <div class="stat-icon icon-green" aria-hidden="true">🌿</div>
              <div class="stat-info">
                <span class="stat-value" id="stat-total-plantas">0</span>
                <span class="stat-label">Total de Plantas</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-amber" aria-hidden="true">⚠️</div>
              <div class="stat-info">
                <span class="stat-value" id="stat-necesitan-agua">0</span>
                <span class="stat-label">Necesitan Agua Hoy</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-blue" aria-hidden="true">💧</div>
              <div class="stat-info">
                <span class="stat-value" id="stat-riegos-totales">0</span>
                <span class="stat-label">Riegos Realizados</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Toolbar & Filter Controls -->
        <section class="toolbar-container" aria-label="Herramientas y filtros de búsqueda">
          <div class="toolbar-search-filter">
            <div class="search-box">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                id="search-input"
                class="search-input"
                placeholder="Buscar por nombre o especie..."
                aria-label="Buscar plantas por nombre o especie"
                autocomplete="off"
              />
            </div>
            <div class="filter-chips" role="radiogroup" aria-label="Filtrar plantas por estado de riego">
              <button type="button" class="filter-chip active" data-filter="todas" role="radio" aria-checked="true">
                🌱 Todas
              </button>
              <button type="button" class="filter-chip" data-filter="sedientas" role="radio" aria-checked="false">
                ⚠️ Sedientas
              </button>
              <button type="button" class="filter-chip" data-filter="hidratadas" role="radio" aria-checked="false">
                💧 Hidratadas
              </button>
            </div>
          </div>
          <div class="toolbar-buttons">
            <button type="button" class="btn btn-primary" id="btn-nueva-planta">
              <span>➕</span>
              <span>Nueva Planta</span>
            </button>
          </div>
        </section>

        <!-- Plant Cards Grid -->
        <main>
          <div id="plants-grid" class="plants-grid" aria-live="polite"></div>
        </main>

        <!-- Footer -->
        <footer class="app-footer">
          <p>
            Huerto Urbano Virtual &bull; Base de Datos Relacional SQLite persistida en el navegador &bull; Desarrollado con TypeScript &amp; sql.js
          </p>
        </footer>
      </div>

      <!-- Plant Form Modal (Create / Edit) -->
      <div id="plant-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="plant-modal-title">
        <div class="modal-container">
          <header class="modal-header">
            <div class="modal-title-wrap">
              <span class="modal-icon" aria-hidden="true">🌿</span>
              <h2 id="plant-modal-title" class="modal-title">Nueva Planta</h2>
            </div>
            <button type="button" class="modal-close-btn" id="btn-close-plant-modal" aria-label="Cerrar modal">✕</button>
          </header>
          <form id="plant-form" novalidate>
            <div class="modal-body">
              <div class="form-group">
                <label for="form-nombre" class="form-label">Nombre de la planta *</label>
                <input
                  type="text"
                  id="form-nombre"
                  class="form-input"
                  placeholder="Ej: Tomate Cherry, Lavanda, Albahaca"
                  required
                />
              </div>

              <div class="form-group">
                <label for="form-especie" class="form-label">Especie botánica o variedad *</label>
                <input
                  type="text"
                  id="form-especie"
                  class="form-input"
                  placeholder="Ej: Solanum lycopersicum"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Ícono / Emoji botánico</label>
                <div class="emoji-grid" id="emoji-picker" role="radiogroup" aria-label="Seleccionar ícono">
                  ${this.emojiList
                    .map(
                      (emoji) => `
                    <button
                      type="button"
                      class="emoji-btn ${emoji === '🌱' ? 'selected' : ''}"
                      data-emoji="${emoji}"
                      aria-label="Ícono ${emoji}"
                    >
                      ${emoji}
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <div class="form-group frequency-control-wrap">
                <label for="form-frecuencia" class="form-label">Frecuencia de riego recomendada *</label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <input
                    type="number"
                    id="form-frecuencia"
                    class="form-input"
                    min="1"
                    max="60"
                    value="3"
                    required
                    style="max-width: 110px;"
                  />
                  <span style="font-size: 0.9rem; color: var(--color-text-muted);">días entre riegos</span>
                </div>
                <div class="frequency-presets" aria-label="Presintonías de frecuencia">
                  <button type="button" class="frequency-chip" data-freq="1">Diario (1d)</button>
                  <button type="button" class="frequency-chip" data-freq="2">Cada 2 días</button>
                  <button type="button" class="frequency-chip active" data-freq="3">Cada 3 días</button>
                  <button type="button" class="frequency-chip" data-freq="5">Cada 5 días</button>
                  <button type="button" class="frequency-chip" data-freq="7">Semanal (7d)</button>
                  <button type="button" class="frequency-chip" data-freq="10">Cada 10 días</button>
                </div>
              </div>

              <div class="form-group">
                <label for="form-ultimo-riego" class="form-label">Fecha del último riego</label>
                <input
                  type="date"
                  id="form-ultimo-riego"
                  class="form-input"
                  required
                />
              </div>

              <div class="form-group">
                <label for="form-salud" class="form-label">Estado de salud inicial</label>
                <select id="form-salud" class="form-select">
                  <option value="Excelente">🟢 Excelente - Vigorosa y saludable</option>
                  <option value="Buena">🔵 Buena - Crecimiento normal</option>
                  <option value="Requiere Atención">🟡 Requiere Atención - Hojas secas o decaídas</option>
                  <option value="Crítica">🔴 Crítica - Marchitamiento o plaga</option>
                </select>
              </div>

              <div class="form-group">
                <label for="form-notas" class="form-label">Notas de cuidado y ubicación</label>
                <textarea
                  id="form-notas"
                  class="form-textarea"
                  placeholder="Ej: Ubicada en balcón este con luz filtrada. Sustrato con perlita."
                ></textarea>
              </div>
            </div>
            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-plant">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btn-save-plant">Guardar Planta</button>
            </footer>
          </form>
        </div>
      </div>

      <!-- History Modal -->
      <div id="history-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
        <div class="modal-container modal-container-lg">
          <header class="modal-header">
            <div class="modal-title-wrap">
              <span class="modal-icon" aria-hidden="true">💧</span>
              <h2 id="history-modal-title" class="modal-title">Historial de Riego</h2>
            </div>
            <button type="button" class="modal-close-btn" id="btn-close-history-modal" aria-label="Cerrar modal">✕</button>
          </header>
          <div class="modal-body">
            <div id="history-plant-banner" class="history-plant-banner"></div>

            <!-- Quick Log Form -->
            <form id="history-quick-form" class="quick-water-form">
              <div class="quick-water-title">
                <span>➕</span>
                <span>Registrar un Riego en esta planta</span>
              </div>
              <div class="quick-water-inputs">
                <div class="form-group">
                  <label for="history-ml" class="form-label">Cantidad (ml)</label>
                  <input type="number" id="history-ml" class="form-input" value="250" min="10" max="5000" step="10" required />
                </div>
                <div class="form-group">
                  <label for="history-date" class="form-label">Fecha</label>
                  <input type="date" id="history-date" class="form-input" required />
                </div>
                <div class="form-group">
                  <label for="history-obs" class="form-label">Observaciones</label>
                  <input type="text" id="history-obs" class="form-input" placeholder="Ej: Riego profundo con nutrientes" />
                </div>
                <button type="submit" class="btn btn-water" style="height: 38px;">
                  💧 Registrar
                </button>
              </div>
            </form>

            <!-- Table of History -->
            <div class="history-table-container">
              <table class="history-table" aria-label="Historial de riegos realizados">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Volumen</th>
                    <th>Observaciones</th>
                    <th style="text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody id="history-table-body">
                </tbody>
              </table>
            </div>
          </div>
          <footer class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-close-history-footer">Cerrar</button>
          </footer>
        </div>
      </div>

      <!-- Toast Container -->
      <div id="toast-container" aria-live="assertive"></div>
    `;

    this.bindInternalDomEvents();
  }

  /**
   * Binds internal DOM interactions (modals opening/closing, emoji selection, form defaults).
   */
  private bindInternalDomEvents(): void {
    // Search input
    const searchInput = document.querySelector<HTMLInputElement>('#search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (this.searchHandler) {
          this.searchHandler(searchInput.value.trim());
        }
      });
    }

    // Filter chips
    const filterButtons = document.querySelectorAll<HTMLButtonElement>('.filter-chip');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        const filter = btn.dataset.filter as 'todas' | 'sedientas' | 'hidratadas';
        if (this.filterChangeHandler && filter) {
          this.filterChangeHandler(filter);
        }
      });
    });

    // Reset Demo button
    const btnResetDemo = document.querySelector<HTMLButtonElement>('#btn-reset-demo');
    if (btnResetDemo) {
      btnResetDemo.addEventListener('click', () => {
        if (confirm('¿Estás seguro de restablecer los datos de demostración? Se recargarán las plantas y riegos iniciales.')) {
          if (this.resetDemoHandler) {
            this.resetDemoHandler();
          }
        }
      });
    }

    // Nueva Planta button
    const btnNuevaPlanta = document.querySelector<HTMLButtonElement>('#btn-nueva-planta');
    if (btnNuevaPlanta) {
      btnNuevaPlanta.addEventListener('click', () => {
        this.openPlantModal();
      });
    }

    // Plant Modal Close / Cancel
    const btnClosePlantModal = document.querySelector<HTMLButtonElement>('#btn-close-plant-modal');
    const btnCancelPlant = document.querySelector<HTMLButtonElement>('#btn-cancel-plant');
    const plantModal = document.querySelector<HTMLElement>('#plant-modal');

    [btnClosePlantModal, btnCancelPlant].forEach((el) => {
      el?.addEventListener('click', () => this.closePlantModal());
    });

    plantModal?.addEventListener('click', (e) => {
      if (e.target === plantModal) {
        this.closePlantModal();
      }
    });

    // History Modal Close
    const btnCloseHistoryModal = document.querySelector<HTMLButtonElement>('#btn-close-history-modal');
    const btnCloseHistoryFooter = document.querySelector<HTMLButtonElement>('#btn-close-history-footer');
    const historyModal = document.querySelector<HTMLElement>('#history-modal');

    [btnCloseHistoryModal, btnCloseHistoryFooter].forEach((el) => {
      el?.addEventListener('click', () => this.closeHistoryModal());
    });

    historyModal?.addEventListener('click', (e) => {
      if (e.target === historyModal) {
        this.closeHistoryModal();
      }
    });

    // Global Escape Key to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePlantModal();
        this.closeHistoryModal();
      }
    });

    // Emoji Picker buttons
    const emojiPicker = document.querySelector<HTMLElement>('#emoji-picker');
    emojiPicker?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.emoji-btn');
      if (target && target.dataset.emoji) {
        document.querySelectorAll('.emoji-btn').forEach((b) => b.classList.remove('selected'));
        target.classList.add('selected');
        this.selectedEmoji = target.dataset.emoji;
      }
    });

    // Frequency Preset Buttons
    const frequencyPresets = document.querySelectorAll<HTMLButtonElement>('.frequency-chip');
    const frequencyInput = document.querySelector<HTMLInputElement>('#form-frecuencia');
    frequencyPresets.forEach((chip) => {
      chip.addEventListener('click', () => {
        const freq = chip.dataset.freq;
        if (freq && frequencyInput) {
          frequencyInput.value = freq;
          frequencyPresets.forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
        }
      });
    });

    frequencyInput?.addEventListener('input', () => {
      const val = frequencyInput.value;
      frequencyPresets.forEach((c) => {
        if (c.dataset.freq === val) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
    });

    // Plant Form Submission
    const plantForm = document.querySelector<HTMLFormElement>('#plant-form');
    plantForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePlantFormSubmit();
    });

    // History Quick Water Form Submission
    const historyForm = document.querySelector<HTMLFormElement>('#history-quick-form');
    historyForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleHistoryQuickFormSubmit();
    });

    // Plants Grid Event Delegation (Water, History, Edit, Delete)
    const plantsGrid = document.querySelector<HTMLElement>('#plants-grid');
    plantsGrid?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const waterBtn = target.closest<HTMLButtonElement>('.btn-water-card');
      if (waterBtn && waterBtn.dataset.id) {
        const id = Number(waterBtn.dataset.id);
        if (this.waterPlantHandler) {
          this.waterPlantHandler(id);
        }
        return;
      }

      const historyBtn = target.closest<HTMLButtonElement>('.btn-history-card');
      if (historyBtn && historyBtn.dataset.id) {
        const id = Number(historyBtn.dataset.id);
        if (this.viewHistoryHandler) {
          this.viewHistoryHandler(id);
        }
        return;
      }

      const editBtn = target.closest<HTMLButtonElement>('.btn-edit-card');
      if (editBtn && editBtn.dataset.id) {
        const id = Number(editBtn.dataset.id);
        if (this.editPlantHandler) {
          this.editPlantHandler(id);
        }
        return;
      }

      const deleteBtn = target.closest<HTMLButtonElement>('.btn-delete-card');
      if (deleteBtn && deleteBtn.dataset.id) {
        const id = Number(deleteBtn.dataset.id);
        const plantName = deleteBtn.dataset.name || 'esta planta';
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${plantName}" y todos sus registros de riego?`)) {
          if (this.deletePlantHandler) {
            this.deletePlantHandler(id);
          }
        }
        return;
      }
    });
  }

  /**
   * Updates top stats counters.
   */
  public updateStats(total: number, sedientas: number, riegosTotales: number): void {
    const elTotal = document.querySelector<HTMLElement>('#stat-total-plantas');
    const elSedientas = document.querySelector<HTMLElement>('#stat-necesitan-agua');
    const elRiegos = document.querySelector<HTMLElement>('#stat-riegos-totales');

    if (elTotal) elTotal.textContent = String(total);
    if (elSedientas) elSedientas.textContent = String(sedientas);
    if (elRiegos) elRiegos.textContent = String(riegosTotales);
  }

  /**
   * Renders the grid of plant cards based on the provided array of plants and calculated states.
   */
  public renderPlantGrid(plantasConEstado: Array<{ planta: Planta; estado: EstadoRiego }>): void {
    const grid = document.querySelector<HTMLElement>('#plants-grid');
    if (!grid) return;

    if (plantasConEstado.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">🪴</div>
          <h3 class="empty-state-title">No se encontraron plantas</h3>
          <p class="empty-state-desc">
            No hay plantas que coincidan con el filtro actual o la búsqueda. ¡Añade una nueva planta a tu huerto urbano!
          </p>
          <button type="button" class="btn btn-primary" onclick="document.querySelector('#btn-nueva-planta')?.click()">
            ➕ Añadir Mi Primera Planta
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = plantasConEstado
      .map(({ planta, estado }) => {
        // Hydration fill class
        let fillClass = 'fill-high';
        if (estado.porcentajeHidratacion <= 25) {
          fillClass = 'fill-low';
        } else if (estado.porcentajeHidratacion <= 55) {
          fillClass = 'fill-mid';
        }

        // Health class (with rule: if not watered today, force "Requiere Atención")
        const healthClassMap: Record<SaludPlanta, string> = {
          'Excelente': 'health-excelente',
          'Buena': 'health-buena',
          'Requiere Atención': 'health-requiere-atencion',
          'Crítica': 'health-critica'
        };
        let displayHealth: SaludPlanta = planta.salud;
        if (estado.diasTranscurridos > 0 && (planta.salud === 'Excelente' || planta.salud === 'Buena')) {
          displayHealth = 'Requiere Atención';
        }
        const healthClass = healthClassMap[displayHealth] || 'health-buena';

        // Card urgent water class
        const cardClass = estado.necesitaAgua ? 'card-needs-water' : 'card-hydrated';
        const waterBtnPulse = estado.necesitaAgua ? 'urgent-pulse' : '';

        return `
          <article class="plant-card ${cardClass}" data-id="${planta.id}">
            <div class="plant-card-header">
              <div class="plant-avatar-container" aria-label="Emoji de la planta">
                ${escapeHtml(planta.icono || '🌱')}
              </div>
              <div class="plant-title-group">
                <h3 class="plant-name" title="${escapeHtml(planta.nombre)}">${escapeHtml(planta.nombre)}</h3>
                <div class="plant-species" title="${escapeHtml(planta.especie)}">${escapeHtml(planta.especie)}</div>
                <span class="plant-health-badge ${healthClass}">${escapeHtml(planta.salud)}</span>
              </div>
            </div>

            <div class="badge-status ${estado.badgeClass}">
              <span>${estado.necesitaAgua ? '⚠️' : '💧'}</span>
              <span>${escapeHtml(estado.mensaje)}</span>
            </div>

            <div class="hydration-section">
              <div class="hydration-labels">
                <span class="hydration-label-title">Nivel de hidratación</span>
                <span class="hydration-label-pct">${estado.porcentajeHidratacion}%</span>
              </div>
              <div class="hydration-track" role="progressbar" aria-valuenow="${estado.porcentajeHidratacion}" aria-valuemin="0" aria-valuemax="100">
                <div class="hydration-fill ${fillClass}" style="width: ${estado.porcentajeHidratacion}%;"></div>
              </div>
            </div>

            <div class="plant-meta-grid">
              <div class="meta-item">
                <span class="meta-label">Frecuencia</span>
                <span class="meta-value">⏱️ Cada ${planta.frecuencia_dias} día${planta.frecuencia_dias > 1 ? 's' : ''}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Último Riego</span>
                <span class="meta-value">📅 ${escapeHtml(planta.ultimo_riego)}</span>
              </div>
            </div>

            ${
              planta.notas
                ? `<div class="plant-notes" title="${escapeHtml(planta.notas)}">
                     <strong>Nota:</strong> ${escapeHtml(planta.notas)}
                   </div>`
                : ''
            }

            <div class="plant-card-actions">
              <button
                type="button"
                class="btn btn-water btn-water-card ${waterBtnPulse}"
                data-id="${planta.id}"
                title="Regar ${escapeHtml(planta.nombre)} ahora"
              >
                <span>💧</span>
                <span>Regar</span>
              </button>
              <div class="secondary-actions">
                <button
                  type="button"
                  class="btn btn-icon-sm btn-history-card"
                  data-id="${planta.id}"
                  title="Ver y gestionar historial de riegos"
                  aria-label="Historial de riegos"
                >
                  📝 Historial
                </button>
                <button
                  type="button"
                  class="btn btn-icon-sm btn-edit-card"
                  data-id="${planta.id}"
                  title="Editar datos de la planta"
                  aria-label="Editar planta"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  class="btn btn-icon-sm btn-icon-danger btn-delete-card"
                  data-id="${planta.id}"
                  data-name="${escapeHtml(planta.nombre)}"
                  title="Eliminar planta"
                  aria-label="Eliminar planta"
                >
                  🗑️
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  /**
   * Opens the Create or Edit modal form.
   */
  public openPlantModal(plantaParaEditar?: Planta): void {
    const modal = document.querySelector<HTMLElement>('#plant-modal');
    const titleEl = document.querySelector<HTMLElement>('#plant-modal-title');
    const inputNombre = document.querySelector<HTMLInputElement>('#form-nombre');
    const inputEspecie = document.querySelector<HTMLInputElement>('#form-especie');
    const inputFrecuencia = document.querySelector<HTMLInputElement>('#form-frecuencia');
    const inputUltimoRiego = document.querySelector<HTMLInputElement>('#form-ultimo-riego');
    const selectSalud = document.querySelector<HTMLSelectElement>('#form-salud');
    const textareaNotas = document.querySelector<HTMLTextAreaElement>('#form-notas');

    if (!modal) return;

    const todayStr = new Date().toISOString().split('T')[0];

    if (plantaParaEditar) {
      this.currentEditingId = plantaParaEditar.id;
      if (titleEl) titleEl.textContent = `Editar: ${plantaParaEditar.nombre}`;
      if (inputNombre) inputNombre.value = plantaParaEditar.nombre;
      if (inputEspecie) inputEspecie.value = plantaParaEditar.especie;
      if (inputFrecuencia) inputFrecuencia.value = String(plantaParaEditar.frecuencia_dias);
      if (inputUltimoRiego) inputUltimoRiego.value = plantaParaEditar.ultimo_riego.split('T')[0];
      if (selectSalud) selectSalud.value = plantaParaEditar.salud;
      if (textareaNotas) textareaNotas.value = plantaParaEditar.notas || '';
      this.selectedEmoji = plantaParaEditar.icono || '🌱';
    } else {
      this.currentEditingId = null;
      if (titleEl) titleEl.textContent = 'Nueva Planta';
      if (inputNombre) inputNombre.value = '';
      if (inputEspecie) inputEspecie.value = '';
      if (inputFrecuencia) inputFrecuencia.value = '3';
      if (inputUltimoRiego) inputUltimoRiego.value = todayStr;
      if (selectSalud) selectSalud.value = 'Excelente';
      if (textareaNotas) textareaNotas.value = '';
      this.selectedEmoji = '🌱';
    }

    // Update selected emoji in picker
    document.querySelectorAll('.emoji-btn').forEach((btn) => {
      const el = btn as HTMLButtonElement;
      if (el.dataset.emoji === this.selectedEmoji) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    // Update frequency preset active class
    const currentFreq = inputFrecuencia?.value || '3';
    document.querySelectorAll('.frequency-chip').forEach((chip) => {
      const el = chip as HTMLButtonElement;
      if (el.dataset.freq === currentFreq) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    modal.classList.add('active');
    setTimeout(() => {
      inputNombre?.focus();
    }, 50);
  }

  /**
   * Closes the Create/Edit modal dialog.
   */
  public closePlantModal(): void {
    const modal = document.querySelector<HTMLElement>('#plant-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.currentEditingId = null;
  }

  /**
   * Handles submission of the plant form.
   */
  private handlePlantFormSubmit(): void {
    const inputNombre = document.querySelector<HTMLInputElement>('#form-nombre');
    const inputEspecie = document.querySelector<HTMLInputElement>('#form-especie');
    const inputFrecuencia = document.querySelector<HTMLInputElement>('#form-frecuencia');
    const inputUltimoRiego = document.querySelector<HTMLInputElement>('#form-ultimo-riego');
    const selectSalud = document.querySelector<HTMLSelectElement>('#form-salud');
    const textareaNotas = document.querySelector<HTMLTextAreaElement>('#form-notas');

    const nombre = inputNombre?.value.trim() || '';
    const especie = inputEspecie?.value.trim() || '';
    const frecuencia_dias = Number(inputFrecuencia?.value) || 3;
    const ultimo_riego = inputUltimoRiego?.value || new Date().toISOString().split('T')[0];
    const salud = (selectSalud?.value as SaludPlanta) || 'Excelente';
    const notas = textareaNotas?.value.trim() || '';

    if (!nombre) {
      this.showToast('Por favor introduce el nombre de la planta.', 'warning');
      inputNombre?.focus();
      return;
    }

    if (!especie) {
      this.showToast('Por favor introduce la especie o variedad botánica.', 'warning');
      inputEspecie?.focus();
      return;
    }

    if (frecuencia_dias <= 0) {
      this.showToast('La frecuencia de riego debe ser mayor o igual a 1 día.', 'warning');
      inputFrecuencia?.focus();
      return;
    }

    const plantData: Omit<Planta, 'id' | 'creada_en'> = {
      nombre,
      especie,
      icono: this.selectedEmoji || '🌱',
      frecuencia_dias,
      ultimo_riego,
      salud,
      notas
    };

    if (this.submitPlantHandler) {
      this.submitPlantHandler(plantData, this.currentEditingId ?? undefined);
    }

    this.closePlantModal();
  }

  /**
   * Opens the history modal for a specific plant, rendering previous waterings and quick log form.
   */
  public openHistoryModal(planta: Planta, riegos: Riego[]): void {
    this.currentHistoryPlanta = planta;
    const modal = document.querySelector<HTMLElement>('#history-modal');
    const banner = document.querySelector<HTMLElement>('#history-plant-banner');
    const tableBody = document.querySelector<HTMLElement>('#history-table-body');
    const historyDate = document.querySelector<HTMLInputElement>('#history-date');
    const historyMl = document.querySelector<HTMLInputElement>('#history-ml');
    const historyObs = document.querySelector<HTMLInputElement>('#history-obs');

    if (!modal || !banner || !tableBody) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (historyDate) historyDate.value = todayStr;
    if (historyMl) historyMl.value = '250';
    if (historyObs) historyObs.value = '';

    banner.innerHTML = `
      <div class="banner-left">
        <span class="banner-avatar">${escapeHtml(planta.icono || '🌱')}</span>
        <div>
          <div class="banner-title">${escapeHtml(planta.nombre)} (${escapeHtml(planta.especie)})</div>
          <div class="banner-subtitle">
            Frecuencia de riego: cada ${planta.frecuencia_dias} días &bull; Salud: ${escapeHtml(planta.salud)} &bull; Último riego: ${escapeHtml(planta.ultimo_riego)}
          </div>
        </div>
      </div>
      <div>
        <span class="water-amount-badge">${riegos.length} riego${riegos.length === 1 ? '' : 's'} registrado${riegos.length === 1 ? '' : 's'}</span>
      </div>
    `;

    if (riegos.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-history-note">
            💧 Aún no se han registrado riegos para esta planta. ¡Utiliza el formulario de arriba para registrar uno!
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = riegos
        .map(
          (riego) => `
        <tr data-riego-id="${riego.id}">
          <td style="font-weight: 600;">📅 ${escapeHtml(riego.fecha)}</td>
          <td><span class="water-amount-badge">💧 ${riego.cantidad_ml} ml</span></td>
          <td style="color: var(--color-text-muted);">${escapeHtml(riego.observaciones || '—')}</td>
          <td style="text-align: right;">
            <button
              type="button"
              class="btn-icon-sm btn-icon-danger btn-delete-riego"
              data-riego-id="${riego.id}"
              data-planta-id="${planta.id}"
              title="Eliminar este registro de riego"
              aria-label="Eliminar registro de riego"
            >
              🗑️
            </button>
          </td>
        </tr>
      `
        )
        .join('');

      // Bind delete buttons inside table
      const deleteButtons = tableBody.querySelectorAll<HTMLButtonElement>('.btn-delete-riego');
      deleteButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const riegoId = Number(btn.dataset.riegoId);
          const plantaId = Number(btn.dataset.plantaId);
          if (confirm('¿Deseas eliminar este registro de riego?')) {
            if (this.deleteWateringHandler) {
              this.deleteWateringHandler(riegoId, plantaId);
            }
          }
        });
      });
    }

    modal.classList.add('active');
  }

  /**
   * Closes the History modal dialog.
   */
  public closeHistoryModal(): void {
    const modal = document.querySelector<HTMLElement>('#history-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.currentHistoryPlanta = null;
  }

  /**
   * Handles quick submission of a new watering from within the History modal.
   */
  private handleHistoryQuickFormSubmit(): void {
    if (!this.currentHistoryPlanta) return;

    const historyMl = document.querySelector<HTMLInputElement>('#history-ml');
    const historyObs = document.querySelector<HTMLInputElement>('#history-obs');

    const ml = Number(historyMl?.value) || 250;
    const obs = historyObs?.value.trim() || '';

    if (this.submitWateringHandler) {
      this.submitWateringHandler(this.currentHistoryPlanta.id, ml, obs);
    }
  }

  /**
   * Displays an animated toast notification in the upper-right corner.
   */
  public showToast(mensaje: string, tipo: 'success' | 'warning' | 'info' | 'error' = 'info'): void {
    const container = document.querySelector<HTMLElement>('#toast-container');
    if (!container) return;

    const iconMap = {
      success: '✅',
      warning: '⚠️',
      info: '💧',
      error: '❌'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${iconMap[tipo]}</span>
      <div class="toast-message">${escapeHtml(mensaje)}</div>
      <button type="button" class="toast-close" aria-label="Cerrar notificación">✕</button>
    `;

    container.appendChild(toast);

    const closeToast = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        toast.remove();
      }, 250);
    };

    toast.querySelector('.toast-close')?.addEventListener('click', closeToast);

    // Auto-dismiss after 3.8 seconds
    setTimeout(closeToast, 3800);
  }

  // =========================================================================
  // Callback Registration Methods
  // =========================================================================

  public onWaterPlant(handler: (id: number) => void): void {
    this.waterPlantHandler = handler;
  }

  public onEditPlant(handler: (id: number) => void): void {
    this.editPlantHandler = handler;
  }

  public onDeletePlant(handler: (id: number) => void): void {
    this.deletePlantHandler = handler;
  }

  public onViewHistory(handler: (id: number) => void): void {
    this.viewHistoryHandler = handler;
  }

  public onSubmitPlant(handler: (data: Omit<Planta, 'id' | 'creada_en'>, id?: number) => void): void {
    this.submitPlantHandler = handler;
  }

  public onSubmitWatering(handler: (plantaId: number, cantidadMl: number, obs: string) => void): void {
    this.submitWateringHandler = handler;
  }

  public onDeleteWatering(handler: (riegoId: number, plantaId: number) => void): void {
    this.deleteWateringHandler = handler;
  }

  public onSearch(handler: (query: string) => void): void {
    this.searchHandler = handler;
  }

  public onFilterChange(handler: (filter: 'todas' | 'sedientas' | 'hidratadas') => void): void {
    this.filterChangeHandler = handler;
  }

  public onResetDemo(handler: () => void): void {
    this.resetDemoHandler = handler;
  }
}
