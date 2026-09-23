# Sistema de Gestión de Marcaciones de Personal (RRHH) - Multicontenedor

**Universidad del Valle - Examen Práctico de Cloud Computing**  
**Estudiante:** Joel Saavedra (`jsaavedra`)  
**Repositorio:** `rrhhmarc-jsaavedra`

---

## 📌 1. Descripción del Proyecto

Aplicación web multicontenedor orientada al departamento de Recursos Humanos para el registro, consulta, modificación, eliminación y filtrado de marcaciones de asistencia de empleados. El sistema calcula de manera automática en el **backend** el estado de puntualidad (`PUNTUAL`, `ATRASO`, `INCOMPLETO`) comparando el horario programado con el horario real registrado.

---

## 🏗️ 2. Arquitectura de Tres Capas

La solución despliega tres contenedores independientes comunicados a través de una red Docker privada (`rrhh-network`):

```
                        Usuario (Navegador)
                                │
                                ▼ (http://localhost:8080)
                     ┌──────────────────────┐
                     │    CONTENEDOR WEB    │  Nginx 1.27 Alpine
                     │   Aplicación RRHH    │  (HTML5 + Vanilla CSS + JS)
                     └──────────┬───────────┘
                                │ (HTTP REST interno /api/)
                                ▼
                     ┌──────────────────────┐
                     │    CONTENEDOR API    │  Node.js 20 Alpine (Express)
                     │  Lógica de Negocio   │  (Determinación de estados y CRUD)
                     └──────────┬───────────┘
                                │ (TCP 5432 - DNS "database")
                                ▼
                     ┌──────────────────────┐
                     │ CONTENEDOR DATABASE  │  PostgreSQL 16 Alpine
                     │  Marcaciones RRHH    │  (Volumen persistente: postgres_data)
                     └──────────────────────┘
```

---

## 🛠️ 3. Tecnologías Utilizadas

- **Base de Datos:** PostgreSQL 16 Alpine con healthcheck nativo (`pg_isready`).
- **Backend / API REST:** Node.js 20 LTS, Express, `pg` (node-postgres), CORS y Dotenv.
- **Frontend / Servidor Web:** Nginx Alpine actuando como servidor estático y Reverse Proxy hacia la API.
- **Orquestación:** Docker y Docker Compose v2.

---

## 🔐 4. Variables de Entorno

La configuración no está incorporada en el código fuente. Se utiliza un archivo `.env` (excluido en `.gitignore`) y una plantilla `.env.example`:

| Variable | Descripción | Valor Predeterminado |
| :--- | :--- | :--- |
| `DB_HOST` | Host de base de datos en la red Docker | `database` |
| `DB_PORT` | Puerto interno de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `rrhh` |
| `DB_USER` | Usuario administrador de la BD | `rrhh_user` |
| `DB_PASSWORD` | Contraseña segura | *(Oculta en .env)* |
| `API_PORT` | Puerto expuesto para la API REST | `3000` |
| `WEB_PORT` | Puerto expuesto para el Frontend Web | `8080` |

---

## 📡 5. Especificación de la API REST

| Método | Endpoint | Descripción | Códigos HTTP |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Estado del backend y conexión a BD | `200`, `500` |
| `GET` | `/api/marcaciones` | Listar todas las marcaciones | `200`, `500` |
| `GET` | `/api/marcaciones?empleado=EMP001` | Filtrar marcaciones por código o nombre | `200`, `500` |
| `GET` | `/api/marcaciones?fecha=2026-09-23` | Filtrar marcaciones por fecha | `200`, `500` |
| `GET` | `/api/marcaciones/:id` | Consultar una marcación específica | `200`, `404`, `500` |
| `POST` | `/api/marcaciones` | Crear nueva marcación (calcula estado) | `201`, `400`, `500` |
| `PUT` | `/api/marcaciones/:id` | Modificar marcación existente | `200`, `400`, `404`, `500` |
| `DELETE` | `/api/marcaciones/:id` | Eliminar marcación | `200`, `404`, `500` |

### Ejemplo de Payload (POST /api/marcaciones):
```json
{
  "codigo_empleado": "EMP001",
  "nombre_empleado": "Ana Pérez",
  "fecha": "2026-09-23",
  "hora_ingreso_programada": "08:00",
  "hora_ingreso_real": "08:12",
  "hora_salida_programada": "16:00",
  "hora_salida_real": "16:05",
  "observacion": "Tráfico en el centro"
}
```

---

## 🧠 6. Respuestas a los Requerimientos Teóricos del Examen

### A. ¿Por qué la API debe acceder a la base de datos usando `database:5432` y NO `localhost:5432`?
En Docker, cada contenedor se ejecuta en su propio espacio de nombres de red (*network namespace*) con su propia dirección IP y su propia interfaz de loopback (`localhost` o `127.0.0.1`). Si la API intenta conectarse a `localhost:5432`, buscaría PostgreSQL **dentro de su propio contenedor**, donde no existe ningún motor de base de datos.  
Al conectar ambos contenedores a la red definida por el usuario (`rrhh-network`), el servidor DNS interno de Docker resuelve automáticamente el nombre del servicio `database` hacia la dirección IP privada del contenedor de PostgreSQL.

### B. ¿Por qué la base de datos no debe exponer su puerto hacia el exterior?
Siguiendo el **Principio de Mínimo Privilegio** y las mejores prácticas de **Seguridad en Capas (Defense in Depth)**, una base de datos que contiene registros de asistencia y datos de empleados no debe ser accesible directamente desde internet o desde la red pública del host. Solo el contenedor `api` (que contiene la lógica de negocio y autenticación) tiene autorización para comunicarse con ella a través de la red interna de Docker.

---

## 🚀 7. Instrucciones de Despliegue Rápido

```bash
# 1. Clonar el repositorio
git clone <URL_REPOSITORIO>
cd rrhhmarc-jsaavedra

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Construir y levantar todos los contenedores en segundo plano
docker compose up -d --build

# 4. Verificar estado de los servicios (deben estar 'Up' y 'healthy')
docker ps

# 5. Abrir la aplicación web en el navegador:
# http://localhost:8080
```
