# Cómo contribuir

Guía rápida del flujo de trabajo con Git/GitHub para colaboradores del proyecto.

## Ramas

No usamos `main`/`master`. Las ramas de integración son:

- **`production`** — rama principal. Al hacer push acá se dispara el build de
  Docker y el deploy a Azure (`.github/workflows/production.yml`).
- **`qa-front`** — integración de frontend. Corre lint + tests unitarios +
  Cypress (`.github/workflows/qa-front.yml`).
- **`qa-back`** — integración de backend. Corre migraciones + tests de API +
  Postman/Newman (`.github/workflows/qa-back.yml`).

**Nunca se pushea directo a estas tres ramas.** Todo cambio entra por Pull
Request.

## Flujo paso a paso

#ANTES DE EMPEZAR TU TRABAJO

### 1. Actualizar tu copia local

```bash
git checkout qa-front            # o qa-back, según lo que toques
git pull origin qa-front
```

### 2. Crear tu rama de trabajo

Nace desde `qa-front` o `qa-back` (no desde `production`):

```bash
git checkout -b feature/nombre-corto-de-la-tarea
```

#DESPUES DE HACER TU TRABAJO

Prefijos sugeridos:

| Prefijo     | Uso                              |
|-------------|-----------------------------------|
| `feature/`  | Funcionalidad nueva                |
| `fix/`      | Corrección de bug                  |
| `hotfix/`   | Corrección urgente sobre producción |
| `chore/`    | Tareas de mantenimiento, configs    |

Ejemplos: `feature/login-google`, `fix/cypress-timeout`.

### 3. Commitear

```bash
git add archivo1 archivo2      # evitá "git add ."
git commit -m "feat: agrega login con Google"
```

Mensajes de commit cortos y en modo imperativo. Si seguís
[Conventional Commits](https://www.conventionalcommits.org/) mejor
(`feat:`, `fix:`, `chore:`, `docs:`), pero no es obligatorio.

### 4. Subir la rama

```bash
git push -u origin feature/nombre-corto-de-la-tarea
```

### 5. Abrir el Pull Request

En GitHub, `Pull requests` → `New pull request`:

- **base:** `qa-front` o `qa-back` (nunca `production` directo).
- **compare:** tu rama `feature/...`.
- Completá la plantilla del PR (`.github/pull_request_template.md`).

Esto dispara el CI de esa rama automáticamente. El PR no se mergea hasta que
el CI esté en verde y tenga al menos una aprobación.

### 6. Code review

Otro colaborador revisa y comenta. Los cambios pedidos se resuelven con
nuevos commits en la misma rama — el PR se actualiza solo, no hace falta
abrir uno nuevo.

### 7. Merge

Una vez aprobado y con el CI en verde, se mergea con **Squash and merge**
para mantener el historial limpio. Borrá la rama después de mergeada.

### 8. Promoción a producción

Cuando lo validado en `qa-front`/`qa-back` está listo para salir, se abre un
PR de esa rama hacia `production`. Ese merge es el que dispara el deploy a
Azure, así que requiere aprobación explícita de un lead antes de mergear.

## Reglas de protección de ramas

`production`, `qa-front` y `qa-back` tienen (o deberían tener) configurado en
GitHub → Settings → Branches:

- Pull request obligatorio, sin push directo.
- CI en verde obligatorio antes de mergear.
- Al menos 1 revisión aprobada.
- Force-push y borrado de rama deshabilitados.
