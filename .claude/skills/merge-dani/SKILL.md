---
name: merge-dani
description: Sincroniza la rama "Dani" con main -- hace push si hace falta, detecta conflictos de forma no destructiva y, si no hay ninguno, hace squash-and-merge vía PR de GitHub y deja Dani limpia y lista para el siguiente ciclo. Único punto de parada: si hay conflictos. Úsalo cuando el usuario pida sincronizar/actualizar/mergear la rama Dani con main, o cuando start-project lo invoque como parte del arranque del proyecto.
---

# Sincronizar y fusionar "Dani" con "main"

Este skill corre de principio a fin **sin pedir confirmación al usuario**,
excepto en el único caso de que se detecten conflictos de merge (paso 4) — ahí
para y reporta, nunca resuelve nada por su cuenta.

**Regla de oro:** cada comando de Bash se emite como una llamada de herramienta
independiente, con el comando exacto (sin encadenar con `;`/`&&`/`|` a otro
comando distinto), para que coincida con la allow-list de `.claude/settings.json`.

## Precondición

- La rama activa debe ser `Dani` y el árbol de trabajo debe estar limpio (sin
  cambios sin commitear ni archivos sin trackear pendientes de decisión). Si no
  se cumple, no continúes — repórtalo y detente. (Si te invoca `start-project`,
  esto ya se comprobó justo antes de llamarte.)

## 1. Fetch y comparación

- `git fetch origin`.
- Compara `Dani` local vs `origin/Dani`:
  - Si local va por delante: `git push origin Dani`.
  - Si diverge (local y remoto tienen cada uno commits que el otro no tiene):
    detente y repórtalo — nunca hagas force-push.
- Compara `origin/Dani` vs `origin/main` (`git log origin/main..origin/Dani`):
  si no hay ningún commit propio de `Dani` que `main` no tenga ya, repórtalo
  como "nada que mergear" y termina aquí, sin tocar nada más.

## 2. Traer main a Dani

- Si `origin/main` tiene commits que `Dani` no tiene, intégralos en `Dani`
  primero (`git merge origin/main` o `git rebase origin/main`, lo que deje el
  historial más simple para este caso). Así cualquier problema de integración
  aparece en tu rama personal, no en la compartida.

## 3. Simulación de merge (no destructiva)

- Usa `git merge-tree` para comprobar si un merge de `Dani` contra `main`
  produciría conflictos, sin tocar el árbol de trabajo real.

## 4. Punto de parada — conflictos

- **Si `merge-tree` señala conflictos:** detente. No los resuelvas de ninguna
  forma automática — requieren criterio humano sobre qué versión es la
  correcta. Reporta qué archivos/hunks chocan y termina el skill aquí (no
  sigas al PR ni al squash-merge).
- **Si no hay conflictos:** continúa sin pedir nada más.

## 5. PR y squash-merge

- `gh pr create --base main --head Dani` con título/cuerpo derivados de los
  commits reales de `Dani` (no genéricos).
- `gh pr merge --squash` sobre ese PR.
- Nota: este repositorio no tiene protección de rama ni CI configurados — el
  único filtro real antes de tocar `main` es la simulación del paso 3.

## 6. Dejar Dani limpia

- Tras el squash-merge, borra `Dani` local (`git branch -D Dani`) y remota
  (`git push origin --delete Dani`), y recréala desde el `main` ya actualizado:
  `git fetch origin`, luego `git checkout -b Dani origin/main`, luego
  `git push -u origin Dani`.
- El contenido de esa tanda de trabajo ya está a salvo en `main` vía el commit
  de squash — este paso solo limpia el historial de commits individuales para
  el siguiente ciclo, no borra código.

## 7. Resumen

Reporta siempre, de forma breve:
- Si hubo push previo de `Dani`.
- Si se detectaron conflictos (y cuáles, si los hubo) — en ese caso, nada más
  de lo de abajo ocurrió.
- SHA del commit de squash en `main` (si se llegó a mergear).
- Confirmación de que `Dani` quedó recreada y sincronizada con `main`, o el
  motivo por el que no se llegó a ese punto.
