# Orden financiero

App para cargar ingresos, gastos y objetivos de ahorro entre dos personas, con exportación a Excel. Los datos quedan guardados en una base de datos propia (SQLite), no depende de ningún servicio externo.

## Qué es cada cosa

- `server.js` y `db.js`: el backend (Node + Express), guarda todo en un archivo de base de datos.
- `public/`: la parte visual (HTML, CSS, JS) que se ve en el navegador, tanto en el celu como en la compu.

## Subir esto a GitHub

1. Andá a GitHub y creá un repositorio nuevo (puede ser privado, ya que pagás GitHub).
2. Subí todos los archivos de esta carpeta a ese repositorio. Podés hacerlo arrastrando los archivos desde la web de GitHub ("uploading an existing file" cuando creás el repo), sin necesidad de usar la terminal.

## Desplegar en Render

1. En Render, creá un **Web Service** nuevo y conectalo al repositorio que acabás de subir.
2. Configuración del servicio:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
3. Andá a la sección **Disks** de ese servicio y agregá un disco persistente:
   - **Mount path:** `/app/data`
   - Tamaño: con 1 GB sobra de sobra.
4. En **Environment**, agregá una variable:
   - `DB_PATH` = `/app/data/orden-financiero.db`
5. Guardá y esperá a que termine el deploy. Render te va a dar una URL (algo como `https://orden-financiero.onrender.com`).

Esa URL es la app. La abrís desde el navegador del celu o de la compu, las dos personas entran a la misma URL y ven los mismos datos, porque todo vive en esa base de datos del servidor, no en cada dispositivo.

## Ojo con esto

- Si el plan de Render duerme el servicio cuando no se usa (algunos planes lo hacen), la primera carga después de un rato inactivo puede tardar unos segundos en responder mientras se despierta. Es normal, no es que se rompió.
- El botón "Exportar Excel" descarga siempre el historial completo hasta ese momento, no solo el mes que están mirando.
- Las categorías vienen precargadas con las de tu planilla, pero se pueden agregar o sacar libremente desde el botón "Categorías" dentro de la app.
