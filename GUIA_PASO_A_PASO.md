# Guía Paso a Paso: Ejecución y Pruebas del Examen Práctico

Esta guía contiene la secuencia exacta de comandos, capturas requeridas y explicaciones técnicas para completar exitosamente la sustentación del examen práctico de **Cloud Computing (Universidad del Valle)**.

> ⚠️ **RECORDATORIO IMPORTANTE PARA EL INFORME:**  
> En cada captura de pantalla que tomes en tu computadora, asegúrate de que sea visible la **hora y fecha de la barra de tareas de Windows**.

---

## 📋 Resumen de las 8 Pruebas Obligatorias

| # | Prueba Obligatoria | Comando / Acción Principal | Evidencia Clave |
|---|---|---|---|
| **1** | Levantamiento de la solución | `docker compose up -d --build` | Contenedores creados en segundo plano |
| **2** | Estado de los contenedores | `docker ps` | 3 servicios activos con `database` en estado `(healthy)` |
| **3** | Creación de marcación vía API | `curl -X POST ... /api/marcaciones` | Respuesta `201 Created` con estado `ATRASO` calculado |
| **4** | Consulta mediante API REST | `curl http://localhost:3000/api/marcaciones` | JSON con el registro de Ana Pérez |
| **5** | Consulta desde la aplicación Web | Navegador en `http://localhost:8080` | Registro visible en la tabla con badge rojo `ATRASO` |
| **6** | Prueba de Filtro | `GET /api/marcaciones?empleado=EMP001` y por fecha | Filtrado reactivo en API y Frontend |
| **7** | Prueba de Persistencia | Eliminar contenedor BD y recrearlo | Los datos de marcaciones siguen disponibles en PostgreSQL |
| **8** | Prueba de Falla y Recuperación | `docker stop rrhh_api` y `docker start` | Identificación de afectación y resiliencia del sistema |

---

## 🚀 PASO 0: Preparación Inicial y Docker Desktop

1. Abre **Docker Desktop** en tu máquina y espera unos segundos hasta que el ícono esté en verde (**Engine running**).
2. Abre una terminal de **PowerShell** en la carpeta del proyecto:
   ```powershell
   cd "C:\Users\wiget\OneDrive\Desktop\rrhhmarc-jsaavedra"
   ```

---

## 🟢 PRUEBA 1: Levantamiento de la Solución

Ejecuta el comando para construir las imágenes personalizadas y levantar los tres contenedores:

```powershell
docker compose up -d --build
```

**Salida esperada:**
- Docker descargará la imagen `postgres:16-alpine`.
- Construirá la imagen `rrhhmarc-jsaavedra-api`.
- Construirá la imagen `rrhhmarc-jsaavedra-web`.
- Creará la red `rrhhmarc-jsaavedra_rrhh-network` y el volumen `postgres_data`.
- Iniciará los contenedores `rrhh_database`, `rrhh_api` y `rrhh_web`.

> 📷 **CAPTURA 1:** Toma captura de la terminal mostrando el comando ejecutado y la confirmación de los contenedores iniciados `[+] Running 4/4`.

---

## 🟢 PRUEBA 2: Estado de los Contenedores (`docker ps`)

Espera 5 a 10 segundos para que el healthcheck de PostgreSQL confirme que la base de datos está lista, y ejecuta:

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Salida esperada:**
```text
NAMES           STATUS                    PORTS
rrhh_web        Up ...                    0.0.0.0:8080->80/tcp
rrhh_api        Up ...                    0.0.0.0:3000->3000/tcp
rrhh_database   Up ... (healthy)          5432/tcp
```

**Puntos a destacar para la evaluación:**
- Se observan los 3 contenedores: `web`, `api`, `database`.
- El contenedor `rrhh_database` muestra explícitamente el estado `(healthy)`.
- El puerto `5432` de la base de datos **no está mapeado al exterior** (seguridad de red).

> 📷 **CAPTURA 2:** Toma captura del comando `docker ps` resaltando el estado `(healthy)` de la base de datos.

---

## 🟢 PRUEBA 3: Creación de Marcación (Ejemplo del Examen)

Registra la marcación oficial solicitada en el enunciado del examen correspondiente a **Ana Pérez**:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/marcaciones" -Method Post -Headers @{"Content-Type"="application/json"} -Body (@{
    codigo_empleado = "EMP001"
    nombre_empleado = "Ana Pérez"
    fecha = "2026-09-23"
    hora_ingreso_programada = "08:00"
    hora_ingreso_real = "08:12"
    hora_salida_programada = "16:00"
    hora_salida_real = "16:05"
    observacion = "Demora por tráfico"
} | ConvertTo-Json)
```

*(O si prefieres usar `curl` en bash / Git Bash)*:
```bash
curl -X POST http://localhost:3000/api/marcaciones \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_empleado": "EMP001",
    "nombre_empleado": "Ana Pérez",
    "fecha": "2026-09-23",
    "hora_ingreso_programada": "08:00",
    "hora_ingreso_real": "08:12",
    "hora_salida_programada": "16:00",
    "hora_salida_real": "16:05",
    "observacion": "Demora por tráfico"
  }'
```

**Salida esperada:**
```json
{
  "id": 4,
  "codigo_empleado": "EMP001",
  "nombre_empleado": "Ana Pérez",
  "fecha": "2026-09-23T00:00:00.000Z",
  "hora_ingreso_programada": "08:00:00",
  "hora_ingreso_real": "08:12:00",
  "hora_salida_programada": "16:00:00",
  "hora_salida_real": "16:05:00",
  "estado": "ATRASO",
  "observacion": "Demora por tráfico"
}
```

**Punto clave a explicar:**  
Nota que en el cuerpo del JSON no enviamos el campo `estado`. El **backend** calculó automáticamente `"estado": "ATRASO"` porque `08:12` es posterior a `08:00`.

> 📷 **CAPTURA 3:** Captura del comando POST y la respuesta JSON devuelta con código `201 Created` y estado `ATRASO`.

---

## 🟢 PRUEBA 4: Consulta mediante API (`GET /api/marcaciones`)

Consulta todos los registros a través de la API REST:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/marcaciones" | ConvertTo-Json -Depth 3
```

**Salida esperada:**  
Una lista en formato JSON que incluye tanto los registros iniciales como el nuevo registro de **Ana Pérez**.

> 📷 **CAPTURA 4:** Captura de la terminal mostrando la lista JSON de marcaciones devuelta por la API.

---

## 🟢 PRUEBA 5: Consulta desde la Aplicación Web

1. Abre tu navegador web (Google Chrome, Edge, Opera, etc.).
2. Ingresa a la URL:
   ```text
   http://localhost:8080
   ```
3. Verifica que la interfaz carga con:
   - Estado: `🟢 API Conectada`.
   - Contador de métricas actualizado (Total, Puntuales, Atrasos).
   - En la tabla aparece **Ana Pérez (EMP001)** con la fecha `2026-09-23`, horas `08:12` y `16:05`, y la etiqueta de estado **ATRASO** en rojo.

> 📷 **CAPTURA 5:** Captura completa del navegador en `http://localhost:8080` mostrando la tabla con el registro de Ana Pérez y las tarjetas de métricas.

---

## 🟢 PRUEBA 6: Prueba de Filtros (Empleado y Fecha)

### Filtro A: Por empleado
En PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/marcaciones?empleado=EMP001" | ConvertTo-Json
```
O en la aplicación web: escribe `EMP001` en el campo "Empleado" y presiona **Filtrar**.

### Filtro B: Por fecha
En PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/marcaciones?fecha=2026-09-23" | ConvertTo-Json
```
O en la aplicación web: selecciona la fecha `2026-09-23` y presiona **Filtrar**.

> 📷 **CAPTURA 6:** Captura en el navegador o en la terminal mostrando el resultado filtrado donde solo aparece la marcación correspondiente.

---

## 🟢 PRUEBA 7: Prueba de Persistencia (Volumen de Docker)

Demuestra que los datos no se pierden aunque el contenedor de la base de datos sea detenido y eliminado por completo:

1. **Detener y eliminar el contenedor de base de datos:**
   ```powershell
   docker stop rrhh_database
   docker rm rrhh_database
   ```

2. **Comprobar que el contenedor ya no existe:**
   ```powershell
   docker ps -a --filter "name=rrhh_database"
   ```

3. **Recrear el servicio de base de datos:**
   ```powershell
   docker compose up -d database
   ```

4. **Esperar a que alcance el estado healthy y consultar nuevamente la información:**
   ```powershell
   Start-Sleep -Seconds 5
   Invoke-RestMethod -Uri "http://localhost:3000/api/marcaciones" | ConvertTo-Json
   ```

**Resultado:**  
Los registros de Ana Pérez y los demás empleados **permanecen intactos**, ya que están almacenados en el volumen Docker administrado `postgres_data`.

> 📷 **CAPTURA 7:** Captura mostrando la eliminación del contenedor (`docker rm`), su recreación (`docker compose up -d database`) y la consulta posterior donde los datos siguen disponibles.

---

## 🟢 PRUEBA 8: Prueba de Falla y Resiliencia (`docker stop api`)

1. **Detener el contenedor de la API:**
   ```powershell
   docker stop rrhh_api
   ```

2. **Identificar la afectación:**
   - Si intentas hacer una petición a la API (`curl http://localhost:3000/api/marcaciones`), la conexión fallará con `Connection refused`.
   - Si abres el navegador en `http://localhost:8080`, el servidor Nginx (`web`) **sigue funcionando y sirviendo la interfaz gráfica**, pero la tabla muestra una alerta amigable: `❌ No se pudo conectar con el API REST`.

3. **Explicar qué componente continúa funcionando:**
   - El contenedor **`database`** sigue activo, funcionando y listo en el puerto 5432.
   - El contenedor **`web`** (Nginx) sigue activo y atendiendo peticiones HTTP en el puerto 8080.
   - Solo la capa intermedia (`api`) está fuera de servicio.

4. **Restaurar el API:**
   ```powershell
   docker start rrhh_api
   ```

5. **Demostrar nuevamente la funcionalidad:**
   ```powershell
   Start-Sleep -Seconds 2
   Invoke-RestMethod -Uri "http://localhost:3000/api/health"
   ```
   Recarga el navegador (`F5`), el badge volverá a mostrar `🟢 API Conectada` y la tabla cargará las marcaciones automáticamente.

> 📷 **CAPTURA 8:** Captura de la terminal con el comando `docker stop rrhh_api`, la verificación de falla y la restauración exitosa con `docker start rrhh_api`.

---

## 🏁 Finalización y Limpieza (Cuando termines tu entrega)

Para detener los servicios sin borrar la información:
```powershell
docker compose down
```

Para reiniciar desde cero eliminando volúmenes (si deseas empezar de nuevo):
```powershell
docker compose down -v
```
