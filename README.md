# Vitrina y carta artesanal

Demo administrativa de una heladería artesanal. Incluye catálogo editable, estados de vitrina, reapertura automática por fecha local, perfiles de demostración, historial, conciliación y copias JSON.

## Ejecutar

```bash
npm install
npm run dev
```

Para generar el sitio estático:

```bash
npm run build
npm run preview
```

## Datos sintéticos

La primera carga usa la clave local `heladeria-vitrina-carta:v2`. Si esa clave no existe, se carga una semilla con los sabores y postres indicados en el briefing, además de movimientos sintéticos y propuestas.

Para reiniciar los datos en el navegador, abrí las herramientas de desarrollo y eliminá únicamente esa clave. La aplicación volverá a sembrar el catálogo al recargar.

## Cómo cambiar la clave

La clave se define una sola vez en `src/domain.js`, en la constante `STORAGE_KEY`. Si se cambia, el catálogo nuevo se sembrará sin leer la copia anterior.

## Persistencia y perfiles

Todo se guarda en `localStorage` en una instantánea versionada con entidades, revisión, eventos y comandos aplicados. El adaptador conserva el estado anterior si `setItem` falla. Operación puede cargar, editar y retirar productos; Revisor decide propuestas con el motor, Auditor sólo consulta.

Los perfiles son actores sintéticos locales y no representan autenticación ni permisos seguros entre dispositivos.

## Reapertura

Los productos marcados como “Agotado hoy” vuelven a “En vitrina” al abrir la aplicación en una fecha local distinta. “Fuera de temporada” no cambia hasta una acción manual. La fecha del agotamiento se guarda por producto.
