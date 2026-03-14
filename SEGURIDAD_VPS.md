# Seguridad VPS — Judicia Agent
### Auditoría y hardening · Marzo 2026

---

## Estado del Firewall (UFW)

| Puerto | Servicio | Acceso | Estado |
|---|---|---|---|
| 22 | SSH | Cualquier IP | Abierto (necesario) |
| 80 | HTTP (nginx) | Cualquier IP | Abierto (necesario) |
| 443 | HTTPS (nginx) | Cualquier IP | Abierto (necesario) |
| 2222 | SFTP (AccessSFTP) | Cualquier IP | Abierto (necesario) |
| 4000 | nginx interno | Cualquier IP | Abierto (necesario) |
| 3002 | judicia-agent webhook | Solo 172.16.0.0/12 (Docker) | Restringido ✅ |
| 8080 | Evolution API | ~~Abierto~~ | **Cerrado Mar 2026** ✅ |
| 5678 | n8n | ~~Abierto~~ | **Cerrado Mar 2026** ✅ |
| 8181 | (nada) | ~~Regla huérfana~~ | **Eliminada Mar 2026** ✅ |

### Acceder a n8n desde afuera (SSH tunnel)
```bash
ssh -L 5678:localhost:5678 root@147.93.9.185
# Luego abrir: http://localhost:5678
```

---

## Claves rotadas (Marzo 2026)

| Variable | Ubicación | Motivo |
|---|---|---|
| `EVOLUTION_API_KEY` / `AUTHENTICATION_API_KEY` | `/opt/botexa/.env` + `/root/judicia-agent/.env` | Valor hardcodeado en código fuente |
| `AGENT_API_KEY` | `/root/judicia-agent/.env` + Vercel env vars | Valor hardcodeado en código fuente |
| `INTERNAL_API_KEY` | `/root/judicia-agent/.env` + Vercel env vars | Valor hardcodeado en código fuente |

**Nota:** Los fallbacks hardcodeados en `agent-service.js` fueron eliminados. Si `.env` no se carga, el servidor falla en lugar de usar claves débiles.

---

## Permisos de archivos sensibles

| Archivo | Antes | Ahora |
|---|---|---|
| `/root/judicia-agent/.env` | `0644` (world-readable) | `0600` (solo root) ✅ |

---

## Arquitectura de puertos internos

```
Internet
   │
   ├── :80 / :443  →  nginx (proxy reverso)
   ├── :22          →  SSH
   └── :2222        →  SFTP

VPS interno (no accesible desde internet)
   ├── :3002  judicia-agent  (solo desde red Docker 172.16/12)
   ├── :8080  Evolution API  (solo localhost → acceso del agente)
   ├── :5678  n8n            (solo localhost → acceso via SSH tunnel)
   ├── :9000  MinIO          (solo localhost)
   └── :3100  Pi scraper     (acceso desde VPS via red local)
```

---

## Notas de seguridad pendientes

- **Rate limiting** en `/query` del agente: sin límite actualmente. Un atacante con la clave podría consumir créditos de cualquier usuario si conoce teléfonos.
- **HMAC signing en Evolution webhook**: Evolution soporta firmar los webhooks con HMAC. Implementar valdría la pena para validar que los POST a `/webhook/evolution/*` vienen realmente de Evolution.
- **MinIO**: credenciales en docker-compose en texto plano. Asegurarse de que el acceso externo esté bloqueado (UFW no expone 9000/9001).

---

## Raspberry Pi — Arquitectura

La Pi está en red local (`192.168.0.179`) y expuesta al exterior via **Cloudflare Tunnel**:

| Servicio | Puerto Pi | URL pública |
|---|---|---|
| PJN Scraper (Puppeteer) | :3100 | `https://pjn.judic-ia.com` |
| ~~Agent legacy~~ | :3002 | `agente.judic-ia.com` (sin uso) |

### Cómo se conecta todo
```
WhatsApp → VPS judicia-agent → pjn.judic-ia.com (Cloudflare) → Pi :3100 (scraper Puppeteer)
Vercel /api/pjn/search → SCRAPER_URL (env var Vercel) → pjn.judic-ia.com → Pi :3100
```

### Variables de entorno relevantes
- VPS agent: `SCRAPER_URL=https://pjn.judic-ia.com`
- VPS agent: `SCRAPER_SECRET=Cthulhu_Scraper_2025_Secret!`
- Vercel: `SCRAPER_URL` debe apuntar a `https://pjn.judic-ia.com`

### Bug corregido (Mar 2026)
El VPS agent tenía `SCRAPER_URL=http://localhost:3101` — no existía nada en ese puerto.
Corregido a `https://pjn.judic-ia.com`. Las búsquedas PJN desde WhatsApp estaban caídas.
