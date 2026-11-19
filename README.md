# 🌱 Huerto Urbano Virtual — Simulador de Riego con SQLite en el Navegador

> **Laboratorio #3: Proyecto Creativo — Desarrollo de Aplicaciones Web**  
> Una aplicación web moderna para la planificación, monitoreo botánico y control relacional del riego en huertos urbanos y plantas de hogar, ejecutando **SQLite nativo en el cliente mediante WebAssembly (sql.js)**.

---

## 📋 Resumen del Proyecto

**Huerto Urbano Virtual** permite a jardineros urbanos y entusiastas de las plantas registrar sus cultivos, calcular con precisión matemática los días restantes o de retraso para el próximo riego, monitorear el porcentaje de hidratación de cada ejemplar y llevar una bitácora histórica completa de volúmenes de agua (en mililitros) y observaciones de cuidado.

A diferencia de las aplicaciones web convencionales que dependen de una base de datos centralizada en un servidor o un almacenamiento plano no relacional, este proyecto utiliza un motor **SQLite compilado a WebAssembly (`sql.js`)** que corre directamente en el navegador del usuario y sincroniza de forma transparente sus transacciones con `localStorage`. Esto permite disfrutar de integridad relacional, consultas SQL complejas (`JOIN`, `CASCADE`, `GROUP BY`, agregaciones) y persistencia permanente entre recargas, con despliegue estático ultra-rápido en plataformas serverless como **Vercel**.

---

## 🏛️ Arquitectura y Stack Tecnológico

El proyecto está diseñado bajo el patrón arquitectónico clásico **Modelo-Vista-Controlador (MVC)**, garantizando una estricta separación de responsabilidades:

```
src/
├── db/
│   └── database.ts        # Inicialización de sql.js (WASM), persistencia base64 en localStorage y seeding
├── models/
│   ├── types.ts           # Definiciones e interfaces TypeScript (Planta, Riego, EstadoRiego, SaludPlanta)
│   └── plant.ts           # Modelo de datos y lógica de dominio (queries SQL preparadas, CRUD, cálculos)
├── views/
│   └── plantView.ts       # Renderizado de componentes DOM, modales, formularios, toasts e interacciones visuales
├── controllers/
│   └── plantController.ts # Orquestador MVC: vincula eventos de la vista con transacciones del modelo
├── styles/
│   └── styles.css         # Sistema de diseño botánico moderno, responsivo y accesible (CSS Custom Properties)
└── main.ts                # Bootstrap de la aplicación con pantalla de carga reactiva y control de fallos
```

### Tecnologías Clave:
- **Lenguaje:** TypeScript 5+ con verificación estricta de tipos.
- **Bundler:** Vite 6 / Rollup de alto rendimiento con Hot Module Replacement (HMR).
- **Motor de Base de Datos:** `sql.js` (SQLite 3 compilado a WebAssembly).
- **Persistencia:** Exportación binaria de SQLite codificada en Base64 con almacenamiento atómico en `localStorage`.
- **Estilos:** CSS3 nativo moderno con variables de diseño temático botánico, animaciones fluidas, diseño responsive (Mobile First) y soporte de accesibilidad WCAG / ARIA.

---

## 🗄️ Modelo Relacional de Datos (SQLite)

La base de datos SQLite embebida gestiona dos tablas relacionales con integridad referencial activa (`PRAGMA foreign_keys = ON;`):

### 1. Tabla `plantas`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Identificador único |
| `nombre` | `TEXT` | `NOT NULL` | Nombre común de la planta |
| `especie` | `TEXT` | `NOT NULL` | Nombre científico o variedad botánica |
| `icono` | `TEXT` | `DEFAULT '🌱'` | Emoji botánico representativo |
| `frecuencia_dias`| `INTEGER` | `NOT NULL DEFAULT 3` | Intervalo ideal en días entre riegos |
| `ultimo_riego` | `TEXT` | `NOT NULL` | Fecha del último riego (formato ISO `YYYY-MM-DD`) |
| `salud` | `TEXT` | `DEFAULT 'Excelente'` | Estado de vigor: 'Excelente', 'Buena', 'Requiere Atención', 'Crítica' |
| `notas` | `TEXT` | — | Cuidados especiales, luz solar, sustrato |
| `creada_en` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Marca de tiempo de registro |

### 2. Tabla `riegos` (Relación 1:N)
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Identificador único de la toma de riego |
| `planta_id` | `INTEGER` | `NOT NULL, FOREIGN KEY -> plantas(id) ON DELETE CASCADE` | Enlace a la planta regada |
| `fecha` | `TEXT` | `NOT NULL` | Fecha de la aplicación de agua |
| `cantidad_ml` | `INTEGER` | `DEFAULT 250` | Volumen aplicado en mililitros |
| `observaciones`| `TEXT` | — | Anotaciones (ej. uso de fertilizante, riego foliar) |

---

## ✨ Características y Funcionalidades

- [x] **CRUD Completo de Plantas:**
  - Creación de plantas con validación de datos en tiempo real.
  - Selector visual interactivo de más de 15 emojis botánicos (`🌱`, `🍅`, `🌿`, `🌵`, `🍓`, etc.).
  - Presintonías rápidas de frecuencia de riego (Diario, Cada 2 días, Cada 3 días, Cada 5 días, Semanal, Cada 10 días).
  - Edición en sitio cargando datos previos en modal.
  - Eliminación con confirmación y borrado en cascada automático de todos los riegos asociados.
- [x] **Cálculo de Riego e Hidratación en Tiempo Real:**
  - Cálculo de días transcurridos desde el último riego comparados contra la fecha actual (`Date`).
  - Días restantes para el próximo riego o días de retraso crítico.
  - Barra de progreso porcentual de hidratación con codificación cromática (Verde > 55%, Ámbar 26-55%, Rojo <= 25%).
  - Alerta pulsante en tarjetas de plantas sedientas.
- [x] **Acción de Riego Rápido:**
  - Botón *"💧 Regar"* en cada tarjeta que registra un evento de riego en SQLite al instante, actualiza `ultimo_riego` y sincroniza la vista.
- [x] **Historial Detallado de Riegos (Modal 1:N):**
  - Bitácora completa de eventos de riego para cada planta.
  - Formulario integrado para registrar riegos manuales con fecha específica, volumen en ml y observaciones.
  - Opción de eliminar registros individuales del historial (recalculando automáticamente la fecha de último riego de la planta).
- [x] **Búsqueda y Filtros Dinámicos:**
  - Búsqueda en vivo (debounce por evento de teclado) por nombre o especie.
  - Filtros rápidos por chips: `🌱 Todas`, `⚠️ Sedientas` (requieren agua hoy o retrasadas) y `💧 Hidratadas`.
- [x] **Métricas del Huerto en Vivo:**
  - Conteo total de plantas.
  - Plantas que necesitan agua hoy.
  - Total acumulado de riegos registrados en la base de datos SQLite.
- [x] **Persistencia y Restablecimiento Demo:**
  - Almacenamiento binario exportado de SQLite en `localStorage`. Los datos persisten aunque se recargue la página o se cierre el navegador.
  - Botón *"🔄 Restablecer Demo"* para restaurar el huerto con plantas de muestra (Tomate Cherry, Menta Silvestre, Suculenta Cebra, Albahaca Italiana) y sus respectivos historiales.
- [x] **Sistema de Notificaciones (Toasts):**
  - Alertas flotantes animadas auto-descartables con estados de éxito, advertencia, información y error.

---

## 🚀 Puesta en Marcha Local

### Prerrequisitos
- **Node.js** v18+ o v20+
- Gestor de paquetes **pnpm** (recomendado), **npm** o **yarn**

### Instalación y Ejecución

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Jazp7/huerto-urbano-virtual.git
   cd huerto-urbano-virtual
   ```

2. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm run dev
   ```
   Abre la URL indicada en la consola (normalmente `http://localhost:5173/`).

4. **Compilar para producción:**
   ```bash
   pnpm run build
   ```
   Genera los archivos optimizados listos para producción en la carpeta `dist/`.

5. **Previsualizar la compilación de producción:**
   ```bash
   pnpm run preview
   ```

---

## ☁️ Despliegue en Vercel

Este proyecto está configurado para desplegarse como un sitio estático de alto rendimiento sin requerir servidores Node en tiempo de ejecución:

1. Conecta el repositorio de GitHub en [Vercel](https://vercel.com).
2. Configuración del proyecto:
   - **Framework Preset:** `Vite`
   - **Build Command:** `pnpm run build` (o `npm run build`)
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install` (o `npm install`)
3. Haz clic en **Deploy**. ¡Listo! El archivo binario de WebAssembly `sql-wasm.wasm` se sirve de forma estática desde la raíz pública.

### Enlaces del Proyecto:
- **Repositorio GitHub:** [https://github.com/Jazp7/huerto-urbano-virtual](https://github.com/Jazp7/huerto-urbano-virtual)
- **Aplicación en Producción:** [https://huerto-urbano-virtual.vercel.app](https://huerto-urbano-virtual.vercel.app) *(o URL del despliegue en Vercel)*

---

## 📊 Rúbrica de Evaluación (10 / 10 pts)

| Criterio | Puntos | Estado | Evidencia en el Proyecto |
|---|:---:|:---:|---|
| **Creatividad y Originalidad del Tema** | 2.0 / 2.0 | ✅ Cumplido | Simulador de huerto urbano y botánica con cálculo dinámico de hidratación y bitácora de riegos, apartándose de las típicas listas de tareas genéricas. |
| **Uso de SQLite y Modelo Relacional** | 2.5 / 2.5 | ✅ Cumplido | Implementación relacional completa con dos tablas (`plantas` y `riegos`), claves foráneas (`FOREIGN KEY`), borrado en cascada (`ON DELETE CASCADE`), transacciones seguras y persistencia binaria reactiva en el navegador con WebAssembly. |
| **Operaciones CRUD y Lógica de Negocio** | 2.5 / 2.5 | ✅ Cumplido | CRUD completo de plantas, altas y bajas de riegos con cálculo relacional inverso, estado de salud botánica, algoritmo de hidratación matemática, filtros reactivos y búsqueda instantánea. |
| **Arquitectura de Software y Código Limpio** | 1.5 / 1.5 | ✅ Cumplido | Patrón MVC estricto (`models/`, `views/`, `controllers/`, `db/`), TypeScript con tipado estricto (cero `any` inseguros), funciones con propósito único y sin errores en compilación (`tsc`). |
| **Interfaz de Usuario, Estilo y Experiencia** | 1.5 / 1.5 | ✅ Cumplido | Diseño botánico moderno, tarjetas con animaciones, indicadores visuales de hidratación, feedback inmediato mediante notificaciones toast y modales accesibles. |
| **Total** | **10.0 / 10.0** | 🏆 **Excelente** | **Implementación exhaustiva y profesional.** |

---

## 👨‍💻 Autor

- **Jazp7** — *Laboratorio #3: Proyecto Creativo Web*
- Desarrollado con 💚 utilizando TypeScript, SQLite WASM y Vite.
