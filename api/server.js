const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.API_PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuración de conexión a PostgreSQL
// Utiliza siempre el host definido en variables de entorno (por defecto 'database', NO 'localhost')
const pool = new Pool({
    host: process.env.DB_HOST || 'database',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'rrhh',
    user: process.env.DB_USER || 'rrhh_user',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Función de determinación automática de estado en la capa de Backend
// Requerimiento de lógica de negocio del examen:
// hora_ingreso_real <= hora_ingreso_programada -> PUNTUAL
// hora_ingreso_real > hora_ingreso_programada  -> ATRASO
function calcularEstado(horaProgIngreso, horaRealIngreso, horaProgSalida, horaRealSalida) {
    if (!horaRealIngreso || !horaProgIngreso) {
        return 'INCOMPLETO';
    }

    const [progH, progM] = horaProgIngreso.split(':').map(Number);
    const [realH, realM] = horaRealIngreso.split(':').map(Number);

    const minutosProg = progH * 60 + progM;
    const minutosReal = realH * 60 + realM;

    if (minutosReal <= minutosProg) {
        return 'PUNTUAL';
    } else {
        return 'ATRASO';
    }
}

// Validador de formato de hora (HH:mm o HH:mm:ss)
function esHoraValida(horaStr) {
    if (!horaStr || typeof horaStr !== 'string') return false;
    const regex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    return regex.test(horaStr.trim());
}

// Validador de formato de fecha (YYYY-MM-DD)
function esFechaValida(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string') return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fechaStr)) return false;
    const d = new Date(fechaStr);
    return d instanceof Date && !isNaN(d.getTime());
}

// Convertidor de hora a minutos para comparar
function horaAMinutos(horaStr) {
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
}

// ----------------------------------------------------
// RUTAS DE LA API REST
// ----------------------------------------------------

// 1. Healthcheck del servicio y la base de datos
app.get('/api/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW() as db_time');
        return res.status(200).json({
            status: 'healthy',
            service: 'rrhh-api',
            database: 'connected',
            server_time: new Date().toISOString(),
            db_time: dbRes.rows[0].db_time
        });
    } catch (error) {
        return res.status(500).json({
            status: 'unhealthy',
            service: 'rrhh-api',
            database: 'disconnected',
            error: error.message
        });
    }
});

// 2. GET /api/marcaciones (Listado con filtros opcionales por empleado o fecha)
app.get('/api/marcaciones', async (req, res) => {
    try {
        const { empleado, fecha } = req.query;
        let query = 'SELECT * FROM marcaciones';
        const params = [];
        const conditions = [];

        if (empleado) {
            params.push(`%${empleado.trim()}%`);
            conditions.push(`(codigo_empleado ILIKE $${params.length} OR nombre_empleado ILIKE $${params.length})`);
        }

        if (fecha) {
            params.push(fecha.trim());
            conditions.push(`fecha = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY fecha DESC, hora_ingreso_real DESC';

        const result = await pool.query(query, params);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al consultar marcaciones:', error);
        return res.status(500).json({ error: 'Error interno del servidor al consultar marcaciones' });
    }
});

// 3. GET /api/marcaciones/:id (Consulta por ID)
app.get('/api/marcaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM marcaciones WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Marcación con ID ${id} no encontrada` });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener marcación:', error);
        return res.status(500).json({ error: 'Error interno del servidor al obtener la marcación' });
    }
});

// 4. POST /api/marcaciones (Registro de nueva marcación)
app.post('/api/marcaciones', async (req, res) => {
    try {
        const {
            codigo_empleado,
            nombre_empleado,
            fecha,
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real,
            observacion
        } = req.body;

        // Validaciones mínimas obligatorias según examen:
        // - Código de empleado obligatorio
        if (!codigo_empleado || String(codigo_empleado).trim() === '') {
            return res.status(400).json({ error: 'El código de empleado es obligatorio' });
        }

        // - Nombre de empleado obligatorio
        if (!nombre_empleado || String(nombre_empleado).trim() === '') {
            return res.status(400).json({ error: 'El nombre del empleado es obligatorio' });
        }

        // - Fecha obligatoria y con formato válido
        if (!fecha || !esFechaValida(fecha)) {
            return res.status(400).json({ error: 'La fecha es obligatoria y debe tener formato YYYY-MM-DD' });
        }

        // - Horas en formato válido
        if (!esHoraValida(hora_ingreso_programada) || !esHoraValida(hora_ingreso_real)) {
            return res.status(400).json({ error: 'Las horas de ingreso programada y real deben tener formato HH:mm válido' });
        }

        if (!esHoraValida(hora_salida_programada) || !esHoraValida(hora_salida_real)) {
            return res.status(400).json({ error: 'Las horas de salida programada y real deben tener formato HH:mm válido' });
        }

        // - La hora de salida no deberá ser anterior a la hora de ingreso
        const minIngresoReal = horaAMinutos(hora_ingreso_real);
        const minSalidaReal = horaAMinutos(hora_salida_real);
        if (minSalidaReal < minIngresoReal) {
            return res.status(400).json({ error: 'La hora de salida real no puede ser anterior a la hora de ingreso real' });
        }

        // Determinación automática del estado en el backend
        const estadoCalculado = calcularEstado(
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real
        );

        const insertQuery = `
            INSERT INTO marcaciones (
                codigo_empleado, nombre_empleado, fecha,
                hora_ingreso_programada, hora_ingreso_real,
                hora_salida_programada, hora_salida_real,
                estado, observacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;

        const values = [
            codigo_empleado.trim(),
            nombre_empleado.trim(),
            fecha,
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real,
            estadoCalculado,
            observacion || null
        ];

        const result = await pool.query(insertQuery, values);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al registrar marcación:', error);
        return res.status(500).json({ error: 'Error interno del servidor al crear la marcación' });
    }
});

// 5. PUT /api/marcaciones/:id (Modificación de marcación)
app.put('/api/marcaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            codigo_empleado,
            nombre_empleado,
            fecha,
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real,
            observacion
        } = req.body;

        // Comprobar existencia
        const check = await pool.query('SELECT * FROM marcaciones WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: `Marcación con ID ${id} no encontrada` });
        }

        // Validaciones
        if (!codigo_empleado || String(codigo_empleado).trim() === '') {
            return res.status(400).json({ error: 'El código de empleado es obligatorio' });
        }
        if (!nombre_empleado || String(nombre_empleado).trim() === '') {
            return res.status(400).json({ error: 'El nombre del empleado es obligatorio' });
        }
        if (!fecha || !esFechaValida(fecha)) {
            return res.status(400).json({ error: 'La fecha es obligatoria y debe tener formato YYYY-MM-DD' });
        }
        if (!esHoraValida(hora_ingreso_programada) || !esHoraValida(hora_ingreso_real)) {
            return res.status(400).json({ error: 'Horas de ingreso inválidas (formato HH:mm)' });
        }
        if (!esHoraValida(hora_salida_programada) || !esHoraValida(hora_salida_real)) {
            return res.status(400).json({ error: 'Horas de salida inválidas (formato HH:mm)' });
        }

        const minIngresoReal = horaAMinutos(hora_ingreso_real);
        const minSalidaReal = horaAMinutos(hora_salida_real);
        if (minSalidaReal < minIngresoReal) {
            return res.status(400).json({ error: 'La hora de salida real no puede ser anterior a la hora de ingreso real' });
        }

        // Recalcular estado automáticamente
        const estadoCalculado = calcularEstado(
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real
        );

        const updateQuery = `
            UPDATE marcaciones SET
                codigo_empleado = $1,
                nombre_empleado = $2,
                fecha = $3,
                hora_ingreso_programada = $4,
                hora_ingreso_real = $5,
                hora_salida_programada = $6,
                hora_salida_real = $7,
                estado = $8,
                observacion = $9
            WHERE id = $10
            RETURNING *;
        `;

        const values = [
            codigo_empleado.trim(),
            nombre_empleado.trim(),
            fecha,
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real,
            estadoCalculado,
            observacion || null,
            id
        ];

        const result = await pool.query(updateQuery, values);
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar marcación:', error);
        return res.status(500).json({ error: 'Error interno al actualizar la marcación' });
    }
});

// 6. DELETE /api/marcaciones/:id (Eliminación de marcación)
app.delete('/api/marcaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM marcaciones WHERE id = $1 RETURNING *;', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Marcación con ID ${id} no encontrada` });
        }

        return res.status(200).json({
            message: `Marcación con ID ${id} eliminada exitosamente`,
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error al eliminar marcación:', error);
        return res.status(500).json({ error: 'Error interno al eliminar la marcación' });
    }
});

// Iniciar servidor con comprobación de conexión a PostgreSQL
app.listen(port, () => {
    console.log(`===============================================`);
    console.log(`🚀 API REST RRHH ejecutándose en el puerto ${port}`);
    console.log(`📡 Conectando a Base de Datos en: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`===============================================`);
});
