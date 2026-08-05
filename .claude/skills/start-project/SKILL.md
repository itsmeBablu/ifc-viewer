---
name: start-project
description: Arranca el proyecto ibviewer (Next.js) en http://localhost:3000, comprobando la rama git "Dani" (incluida su sincronización/merge con main vía el skill merge-dani), dependencias, el MCP codebase-memory-mcp y el estado del puerto. Úsalo cuando el usuario pida arrancar, levantar, iniciar o correr el proyecto/la app/el servidor de desarrollo.
---

# Arrancar ibviewer

Ejecuta estas comprobaciones en orden. Todas las respuestas de este skill deben ser
afirmativas por defecto (no pidas confirmación al usuario para los pasos de abajo,
ya que están cubiertos por la allow-list de `.claude/settings.json`). La única
excepción es si tienes que tomar una decisión de código/diseño (p. ej. qué versión
de Node instalar, qué valor poner en una variable de entorno) — ahí sí pregunta.

**Regla de oro para que la allow-list funcione de verdad:** cada comando de Bash o
PowerShell debe emitirse como **una llamada de herramienta independiente, con el
comando exacto y canónico** (sin envolverlo en un bucle `for`/`while`, sin
encadenarlo con `;`, `&&` ni `|` a otro comando distinto). La allow-list compara
el comienzo literal del comando — un bucle o una cadena de comandos no coincide
con la regla aunque contenga el comando permitido dentro, y puede acabar pidiendo
confirmación innecesariamente. Si necesitas reintentar algo (p. ej. el health
check), reintenta con varias llamadas de herramienta separadas, no con un bucle
de shell.

## 1. Rama de Git — siempre "Dani"

- Ejecuta `git fetch origin` para tener las referencias remotas al día.
- Comprueba en qué rama estás (`git rev-parse --abbrev-ref HEAD`):
  - Si ya estás en `Dani`, sigue.
  - Si existe la rama local `Dani`, cámbiate (`git switch Dani` / `git checkout Dani`).
  - Si no existe localmente pero sí en `origin/Dani`, créala rastreándola
    (`git switch -c Dani origin/Dani` / `git checkout -b Dani origin/Dani`).
  - Si no existe ni local ni en remoto, avisa al usuario — no la inventes ni
    trabajes en otra rama por defecto.
- Comprueba que está limpia (`git status --porcelain`):
  - Si hay cambios sin commitear (tracked) o archivos sin trackear, **no
    continúes automáticamente** — esto sí es una decisión del usuario (podría
    ser trabajo en curso). Avisa qué hay pendiente y espera instrucciones.
- Comprueba sincronización con `origin/Dani`:
  - Si tu rama local está detrás, intenta `git pull --ff-only origin Dani`
    (fast-forward únicamente, nunca crea merges ni reescribe historia).
  - Si ha divergido (`--ff-only` falla) o vas por delante de forma inesperada,
    avisa al usuario y no fuerces nada (nada de merge/rebase/reset automáticos).
- Solo si la rama es `Dani`, está limpia y sincronizada, continúa con el paso 2.

## 2. Sincronizar y fusionar Dani con main

- Invoca el skill **`merge-dani`** (tool `Skill`, `skill: "merge-dani"`) en este
  punto — es el único responsable de esa lógica (push, detección de conflictos,
  squash-merge por PR, limpieza de la rama); no la dupliques aquí.
- Este paso es *best effort* y no bloqueante: si `merge-dani` reporta conflictos,
  anota el aviso para el resumen final (paso 9) y **continúa** con el resto del
  arranque sobre el estado actual de `Dani` — un conflicto contra `main` no debe
  impedirte levantar el servidor local.
- Si `merge-dani` completó un squash-merge y recreó `Dani`, ya estás sobre la
  `Dani` nueva (limpia, con diff cero contra `main`) — continúa el resto de
  pasos sobre ese estado actualizado.

## 3. Versión de Node.js

- Ejecuta `node -v`.
- Compara contra el campo `engines.node` de `package.json` (si existe).
- Si no coincide o no hay `engines`, avísalo en el resumen final pero no bloquees
  el arranque por esto — es informativo.

## 4. Dependencias instaladas

- Comprueba si existe `node_modules` (`test -d node_modules`) y, si existe, si
  `node_modules/.package-lock.json` (lockfile interno que npm genera tras
  instalar) coincide con el `package-lock.json` de la raíz.
- Si `node_modules` no existe, o los lockfiles difieren, o faltan: ejecuta
  `npm ci` (no `npm install`, para respetar versiones exactas del lockfile).
- Si `npm ci` falla, informa el error real al usuario — no lo silencies ni lo
  reintentes en bucle.

## 5. codebase-memory-mcp

- Comprueba si las tools `mcp__codebase-memory-mcp__*` están disponibles (por
  ejemplo con `ToolSearch("select:mcp__codebase-memory-mcp__index_status")`).
- **Si no están disponibles** (el MCP no está instalado/registrado):
  1. Clona `https://github.com/DeusData/codebase-memory-mcp.git` (en una carpeta
     de herramientas fuera de este repo, no dentro de `ibviewer/`).
  2. Sigue el README de ese repo para instalar dependencias y compilar/arrancar
     el servidor MCP.
  3. Regístralo como servidor MCP (vía `claude mcp add` o el `.mcp.json`
     correspondiente) y reconecta para que sus tools queden disponibles.
- Comprueba con `index_status` si **esta ruta exacta** ya está indexada (puede
  haber índices de otras copias del repo en otras rutas — no sirven).
- Si no está indexada: ejecuta `index_repository` sobre esta carpeta.
- Si ya está indexada: ejecuta `detect_changes` y, si hay cambios pendientes,
  reindexa.

## 6. Variables de entorno

- Comprueba si existe `.env.local` o `.env` (`test -f .env.local`, `test -f .env`
  — como llamadas separadas, no encadenadas).
- Si el código referencia variables de entorno (`process.env.*`) que no están
  definidas en ningún `.env*` presente, avísalo en el resumen final.

## 7. Puerto 3000

- Comprueba qué proceso ocupa el puerto 3000 con una única llamada PowerShell:
  `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue`.
- Si hay algo escuchando, identifica el proceso con llamadas **separadas** (no
  encadenadas con `;`): primero `Get-Process -Id <pid>`, luego, en otra llamada,
  `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` para ver su línea de
  comandos.
  - Si es un proceso `node.exe` cuya línea de comandos apunta a este proyecto
    (`next dev` en esta ruta): mátalo (`Stop-Process -Id <pid> -Force`) y
    vuelve a arrancar.
  - Si es cualquier otro proceso (incluido un `next dev` de **otra** copia del
    repo en otra ruta): **no lo mates** sin más. Avisa al usuario de qué proceso
    es y dónde vive, y pregúntale cómo proceder.
- Arranca el servidor de desarrollo en segundo plano: `npm run dev`
  (`run_in_background: true`).

## 8. Health check

- Espera brevemente a que compile y haz una petición real con **una única
  llamada** `curl http://localhost:3000 -s -o /dev/null -w "%{http_code}"`
  (URL como primer argumento, sin envolver en un bucle de shell, para que
  coincida con la regla de `.claude/settings.json`).
- Si no responde aún, reintenta con **otra llamada de herramienta separada**
  tras una espera corta (Next.js puede tardar unos segundos en compilar la
  primera vez) — nunca un bucle `for`/`while` en una sola llamada.
- No des el arranque por bueno solo porque el proceso se lanzó — confirma la
  respuesta HTTP.

## 9. Resumen final

- Si todo lo anterior está en orden: responde simplemente
  **"Todo al día y a la espera de órdenes"**.
- Si falta algo o hubo que corregir algo (se instalaron dependencias, se
  reindexó, se mató un proceso, falta una env var, versión de Node distinta,
  `merge-dani` encontró conflictos, etc.): resume brevemente qué se hizo o qué
  falta, sin relleno.
