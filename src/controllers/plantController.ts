import type { Planta } from '../models/types.ts';
import {
  getAllPlantas,
  getPlantaById,
  createPlanta,
  updatePlanta,
  deletePlanta,
  registrarRiego,
  getRiegosByPlanta,
  deleteRiego,
  resetDemoData,
  calcularEstadoRiego,
} from '../models/plant.ts';
import { exec } from '../db/tursoClient.ts';
import { PlantView } from '../views/plantView.ts';

export class PlantController {
  private view: PlantView;
  private filter: 'todas' | 'sedientas' | 'hidratadas' = 'todas';
  private searchQuery: string = '';

  constructor(view: PlantView) {
    this.view = view;
  }

  /**
   * Initializes the controller, sets up view callbacks, and triggers initial render.
   */
  public init(): void {
    this.view.renderAppSkeleton();

    // Register View event listeners / callbacks
    this.view.onWaterPlant((id) => this.handleWaterPlant(id));
    this.view.onEditPlant((id) => this.handleEditPlant(id));
    this.view.onDeletePlant((id) => this.handleDeletePlant(id));
    this.view.onViewHistory((id) => this.handleViewHistory(id));
    this.view.onSubmitPlant((data, id) => this.handleSubmitPlant(data, id));
    this.view.onSubmitWatering((plantaId, ml, obs) => this.handleSubmitWatering(plantaId, ml, obs));
    this.view.onDeleteWatering((riegoId, plantaId) => this.handleDeleteWatering(riegoId, plantaId));
    this.view.onSearch((q) => this.handleSearch(q));
    this.view.onFilterChange((f) => this.handleFilterChange(f));
    this.view.onResetDemo(() => this.handleResetDemo());

    this.refreshView();
  }

  /**
   * Refreshes stats, applies search and status filters, and renders the plant cards grid.
   */
  public async refreshView(): Promise<void> {
    try {
      const allPlants = await getAllPlantas();
      const plantasConEstado = allPlants.map((planta) => ({
        planta,
        estado: calcularEstadoRiego(planta)
      }));

      // Calculate stats
      const total = allPlants.length;
      const sedientas = plantasConEstado.filter((item) => item.estado.necesitaAgua).length;

      let totalRiegos = 0;
      try {
        const countResult = await exec('SELECT COUNT(*) AS count FROM riegos');
        totalRiegos = Number(countResult[0]?.count) || 0;
      } catch (err) {
        console.warn('Could not query riegos count directly from SQLite:', err);
      }

      this.view.updateStats(total, sedientas, totalRiegos);

      // Apply filter
      let filtered = plantasConEstado;
      if (this.filter === 'sedientas') {
        filtered = filtered.filter((item) => item.estado.necesitaAgua);
      } else if (this.filter === 'hidratadas') {
        filtered = filtered.filter((item) => !item.estado.necesitaAgua);
      }

      // Apply search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (item) =>
            item.planta.nombre.toLowerCase().includes(query) ||
            item.planta.especie.toLowerCase().includes(query)
        );
      }

      this.view.renderPlantGrid(filtered);
    } catch (error) {
      console.error('Error refreshing plant view:', error);
      this.view.showToast('Error al actualizar las plantas del huerto', 'error');
    }
  }

  /**
   * Handles quick watering button click on a plant card.
   */
  public async handleWaterPlant(id: number): Promise<void> {
    try {
      const res = await registrarRiego(id, 250, 'Riego rápido manual');
      if (res.saludMejorada) {
        this.view.showToast(`💧 ¡Planta regada! Su salud mejoró a "${res.nuevaSalud}" y está 100% hidratada.`, 'success');
      } else {
        this.view.showToast('💧 ¡Planta regada con éxito! Hidratación al 100%.', 'success');
      }
      await this.refreshView();
    } catch (error) {
      console.error('Error watering plant:', error);
      this.view.showToast('No se pudo registrar el riego', 'error');
    }
  }

  /**
   * Handles editing a plant.
   */
  public async handleEditPlant(id: number): Promise<void> {
    const planta = await getPlantaById(id);
    if (!planta) {
      this.view.showToast('Planta no encontrada', 'error');
      return;
    }
    this.view.openPlantModal(planta);
  }

  /**
   * Handles deletion of a plant.
   */
  public async handleDeletePlant(id: number): Promise<void> {
    try {
      const deleted = await deletePlanta(id);
      if (deleted) {
        this.view.showToast('🗑️ Planta eliminada del huerto', 'info');
        await this.refreshView();
      } else {
        this.view.showToast('No se pudo eliminar la planta', 'warning');
      }
    } catch (error) {
      console.error('Error deleting plant:', error);
      this.view.showToast('Error al eliminar la planta', 'error');
    }
  }

  /**
   * Handles opening the watering history modal for a plant.
   */
  public async handleViewHistory(id: number): Promise<void> {
    const planta = await getPlantaById(id);
    if (!planta) {
      this.view.showToast('Planta no encontrada', 'error');
      return;
    }
    const riegos = await getRiegosByPlanta(id);
    this.view.openHistoryModal(planta, riegos);
  }

  /**
   * Handles submitting the plant modal (create or update).
   */
  public async handleSubmitPlant(
    data: Omit<Planta, 'id' | 'creada_en'>,
    id?: number
  ): Promise<void> {
    try {
      if (id !== undefined) {
        const success = await updatePlanta(id, data);
        if (success) {
          this.view.showToast(`✅ Planta actualizada • Salud: ${data.salud}`, 'success');
        } else {
          this.view.showToast('No se pudo actualizar la planta', 'warning');
        }
      } else {
        await createPlanta(data);
        this.view.showToast('🌱 ¡Nueva planta añadida al huerto!', 'success');
      }
      this.view.closePlantModal();
      await this.refreshView();
    } catch (error) {
      console.error('Error saving plant:', error);
      this.view.showToast('Error al guardar los datos de la planta', 'error');
    }
  }

  /**
   * Handles submitting a watering record inside the history modal.
   */
  public async handleSubmitWatering(plantaId: number, ml: number, obs: string): Promise<void> {
    try {
      const res = await registrarRiego(plantaId, ml, obs);
      const planta = await getPlantaById(plantaId);
      const riegos = await getRiegosByPlanta(plantaId);
      if (planta) {
        this.view.openHistoryModal(planta, riegos);
      }
      if (res.saludMejorada) {
        this.view.showToast(`💧 Riego de ${ml} ml registrado. ¡Salud mejorada a "${res.nuevaSalud}"!`, 'success');
      } else {
        this.view.showToast(`💧 Riego de ${ml} ml registrado con éxito`, 'success');
      }
      await this.refreshView();
    } catch (error) {
      console.error('Error recording watering:', error);
      this.view.showToast('Error al registrar el riego', 'error');
    }
  }

  /**
   * Handles deleting a single watering record inside the history modal.
   */
  public async handleDeleteWatering(riegoId: number, plantaId: number): Promise<void> {
    try {
      const deleted = await deleteRiego(riegoId);
      if (deleted) {
        const planta = await getPlantaById(plantaId);
        const riegos = await getRiegosByPlanta(plantaId);
        if (planta) {
          this.view.openHistoryModal(planta, riegos);
        }
        this.view.showToast('Registro de riego eliminado', 'info');
        await this.refreshView();
      } else {
        this.view.showToast('No se pudo eliminar el registro de riego', 'warning');
      }
    } catch (error) {
      console.error('Error deleting watering:', error);
      this.view.showToast('Error al eliminar el registro de riego', 'error');
    }
  }

  /**
   * Handles real-time search input.
   */
  public handleSearch(query: string): void {
    this.searchQuery = query;
    this.refreshView();
  }

  /**
   * Handles status filter change.
   */
  public handleFilterChange(filter: 'todas' | 'sedientas' | 'hidratadas'): void {
    this.filter = filter;
    this.refreshView();
  }

  /**
   * Handles resetting the database to demo data.
   */
  public async handleResetDemo(): Promise<void> {
    try {
      await resetDemoData();
      this.view.showToast('🔄 Huerto restablecido a valores demo', 'info');
      this.refreshView();
    } catch (error) {
      console.error('Error resetting demo data:', error);
      this.view.showToast('Error al restablecer los datos de demo', 'error');
    }
  }
}
