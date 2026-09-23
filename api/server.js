const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.API_PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuracion de conexion a PostgreSQL
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

// Auto-sincronizacion de esquema para garantizar tabla empleados y secuencia
async function ensureSchema() {
    try {
        await pool.query(`
            CREATE SEQUENCE IF NOT EXISTS empleado_seq START WITH 5;

            CREATE TABLE IF NOT EXISTS empleados (
                id SERIAL PRIMARY KEY,
                codigo_empleado VARCHAR(20) UNIQUE NOT NULL,
                nombre_completo VARCHAR(120) NOT NULL,
                cargo VARCHAR(80),
                departamento VARCHAR(80),
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_empleados_codigo ON empleados(codigo_empleado);

            INSERT INTO empleados (id, codigo_empleado, nombre_completo, cargo, departamento) VALUES
            (1, 'EMP001', 'Ana Perez', 'Analista de Sistemas', 'Tecnologia'),
            (2, 'EMP002', 'Carlos Mendoza', 'Contador General', 'Finanzas'),
            (3, 'EMP003', 'Valeria Rojas', 'Especialista en RRHH', 'Recursos Humanos'),
            (4, 'EMP004', 'Diego Morales', 'Desarrollador Backend', 'Tecnologia')
            ON CONFLICT (codigo_empleado) DO NOTHING;

            CREATE TABLE IF NOT EXISTS marcaciones (
                id SERIAL PRIMARY KEY,
                codigo_empleado VARCHAR(50) NOT NULL,
                nombre_empleado VARCHAR(100) NOT NULL,
                fecha DATE NOT NULL,
                hora_ingreso_programada TIME NOT NULL,
                hora_ingreso_real TIME NOT NULL,
                hora_salida_programada TIME NOT NULL,
                hora_salida_real TIME NOT NULL,
                estado VARCHAR(50) NOT NULL,
                observacion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_marcaciones_empleado ON marcaciones(codigo_empleado);
            CREATE INDEX IF NOT EXISTS idx_marcaciones_fecha ON marcaciones(fecha);
        `);
        console.log('Esquema de base de datos verificado y sincronizado correctamente.');
    } catch (err) {
        console.error('Aviso de inicializacion de esquema (continuando):', err.message);
    }
}

// Logica de calculo de estado: PUNTUAL vs ATRASO
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

function esHoraValida(horaStr) {
    if (!horaStr || typeof horaStr !== 'string') return false;
    const regex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    return regex.test(horaStr.trim());
}

function esFechaValida(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string') return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fechaStr)) return false;
    const d = new Date(fechaStr);
    return d instanceof Date && !isNaN(d.getTime());
}

function horaAMinutos(horaStr) {
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
}

async function calcularProximoCodigoEmpleado() {
    const maxRes = await pool.query("SELECT codigo_empleado FROM empleados WHERE codigo_empleado ~ '^EMP[0-9]+$' ORDER BY length(codigo_empleado) DESC, codigo_empleado DESC LIMIT 1");
    let nextNum = 1;
    if (maxRes.rows.length > 0) {
        const match = maxRes.rows[0].codigo_empleado.match(/EMP(\d+)/);
        if (match) {
            nextNum = parseInt(match[1], 10) + 1;
        }
    }
    return `EMP${String(nextNum).padStart(3, '0')}`;
}

//#region Rutas

// GET /api/health
app.get('/api/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW() as db_time');
        return res.status(200).json({
            status: 'UP',
            service: 'rrhh-api',
            database: 'CONNECTED',
            timestamp: dbRes.rows[0].db_time
        });
    } catch (error) {
        console.error('Fallo en healthcheck de base de datos:', error.message);
        return res.status(503).json({
            status: 'DOWN',
            service: 'rrhh-api',
            database: 'DISCONNECTED',
            error: error.message
        });
    }
});

//#region Rutas Empleados

// GET /api/empleados - Lista de empleados con filtro opcional de busqueda
app.get('/api/empleados', async (req, res) => {
    try {
        const { q, activo } = req.query;
        let query = 'SELECT * FROM empleados';
        const conditions = [];
        const params = [];

        if (activo !== undefined) {
            params.push(activo === 'true' || activo === '1');
            conditions.push(`activo = $${params.length}`);
        }

        if (q && q.trim() !== '') {
            params.push(`%${q.trim().toLowerCase()}%`);
            conditions.push(`(LOWER(codigo_empleado) LIKE $${params.length} OR LOWER(nombre_completo) LIKE $${params.length})`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY codigo_empleado ASC';
        const result = await pool.query(query, params);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al listar empleados:', error);
        return res.status(500).json({ error: 'Error interno al consultar empleados' });
    }
});

// GET /api/empleados/siguiente-codigo - Previsualizar el siguiente codigo EMP00X
app.get('/api/empleados/siguiente-codigo', async (req, res) => {
    try {
        const nextCode = await calcularProximoCodigoEmpleado();
        return res.status(200).json({ siguiente_codigo: nextCode });
    } catch (error) {
        console.error('Error al calcular siguiente codigo:', error);
        return res.status(500).json({ error: 'Error al calcular siguiente codigo' });
    }
});

// POST /api/empleados - Crear nuevo empleado con asignacion automatica de codigo
app.post('/api/empleados', async (req, res) => {
    try {
        const { nombre_completo, cargo, departamento } = req.body;
        if (!nombre_completo || String(nombre_completo).trim() === '') {
            return res.status(400).json({ error: 'El nombre completo del empleado es obligatorio' });
        }

        let codigoAsignado = req.body.codigo_empleado ? req.body.codigo_empleado.trim().toUpperCase() : null;
        if (!codigoAsignado) {
            codigoAsignado = await calcularProximoCodigoEmpleado();
        }

        const insertRes = await pool.query(
            `INSERT INTO empleados (codigo_empleado, nombre_completo, cargo, departamento, activo)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING *;`,
            [codigoAsignado, nombre_completo.trim(), (cargo || '').trim() || null, (departamento || '').trim() || null]
        );

        return res.status(201).json(insertRes.rows[0]);
    } catch (error) {
        console.error('Error al crear empleado:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El codigo de empleado ya existe' });
        }
        return res.status(500).json({ error: 'Error interno al registrar empleado' });
    }
});

//#endregion Rutas Empleados

//#region Rutas Marcaciones

// GET /api/marcaciones con filtros query ?empleado= &fecha=
app.get('/api/marcaciones', async (req, res) => {
    try {
        const { empleado, fecha } = req.query;
        let query = 'SELECT * FROM marcaciones';
        const params = [];
        const conditions = [];

        if (empleado) {
            params.push(`%${empleado.trim().toLowerCase()}%`);
            conditions.push(`(LOWER(codigo_empleado) LIKE $${params.length} OR LOWER(nombre_empleado) LIKE $${params.length})`);
        }

        if (fecha) {
            if (!esFechaValida(fecha)) {
                return res.status(400).json({ error: 'Formato de fecha invalido. Debe ser YYYY-MM-DD' });
            }
            params.push(fecha);
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

// GET /api/marcaciones/:id
app.get('/api/marcaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM marcaciones WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Marcacion con ID ${id} no encontrada` });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener marcacion:', error);
        return res.status(500).json({ error: 'Error interno del servidor al obtener la marcacion' });
    }
});

// POST /api/marcaciones
app.post('/api/marcaciones', async (req, res) => {
    try {
        let {
            codigo_empleado,
            nombre_empleado,
            fecha,
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real,
            observacion
        } = req.body;

        if (!codigo_empleado || String(codigo_empleado).trim() === '') {
            return res.status(400).json({ error: 'El codigo de empleado es obligatorio' });
        }

        // Si se envio codigo de empleado pero no nombre, intentar resolverlo desde la tabla empleados
        if (!nombre_empleado || String(nombre_empleado).trim() === '') {
            const empRes = await pool.query('SELECT nombre_completo FROM empleados WHERE codigo_empleado = $1', [codigo_empleado.trim().toUpperCase()]);
            if (empRes.rows.length > 0) {
                nombre_empleado = empRes.rows[0].nombre_completo;
            } else {
                return res.status(400).json({ error: 'El nombre del empleado es obligatorio' });
            }
        }

        if (!fecha || !esFechaValida(fecha)) {
            return res.status(400).json({ error: 'La fecha es obligatoria y debe tener formato YYYY-MM-DD' });
        }
        if (!esHoraValida(hora_ingreso_programada) || !esHoraValida(hora_ingreso_real)) {
            return res.status(400).json({ error: 'Las horas de ingreso programada y real deben tener formato HH:mm valido' });
        }
        if (!esHoraValida(hora_salida_programada) || !esHoraValida(hora_salida_real)) {
            return res.status(400).json({ error: 'Las horas de salida programada y real deben tener formato HH:mm valido' });
        }

        const minIngresoReal = horaAMinutos(hora_ingreso_real);
        const minSalidaReal = horaAMinutos(hora_salida_real);
        if (minSalidaReal < minIngresoReal) {
            return res.status(400).json({ error: 'La hora de salida real no puede ser anterior a la hora de ingreso real' });
        }

        const estadoCalculado = calcularEstado(
            hora_ingreso_programada,
            hora_ingreso_real,
            hora_salida_programada,
            hora_salida_real
        );

        // Asegurar que el empleado este en la tabla empleados para integridad del combo
        try {
            await pool.query(
                `INSERT INTO empleados (codigo_empleado, nombre_completo, activo)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT (codigo_empleado) DO NOTHING;`,
                [codigo_empleado.trim().toUpperCase(), nombre_empleado.trim()]
            );
        } catch (ignored) {}

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
            codigo_empleado.trim().toUpperCase(),
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
        console.error('Error al registrar marcacion:', error);
        return res.status(500).json({ error: 'Error interno del servidor al crear la marcacion' });
    }
});

// PUT /api/marcaciones/:id
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

        const check = await pool.query('SELECT * FROM marcaciones WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: `Marcacion con ID ${id} no encontrada` });
        }

        if (!codigo_empleado || String(codigo_empleado).trim() === '') {
            return res.status(400).json({ error: 'El codigo de empleado es obligatorio' });
        }
        if (!nombre_empleado || String(nombre_empleado).trim() === '') {
            return res.status(400).json({ error: 'El nombre del empleado es obligatorio' });
        }
        if (!fecha || !esFechaValida(fecha)) {
            return res.status(400).json({ error: 'La fecha es obligatoria y debe tener formato YYYY-MM-DD' });
        }
        if (!esHoraValida(hora_ingreso_programada) || !esHoraValida(hora_ingreso_real)) {
            return res.status(400).json({ error: 'Horas de ingreso invalidas (formato HH:mm)' });
        }
        if (!esHoraValida(hora_salida_programada) || !esHoraValida(hora_salida_real)) {
            return res.status(400).json({ error: 'Horas de salida invalidas (formato HH:mm)' });
        }

        const minIngresoReal = horaAMinutos(hora_ingreso_real);
        const minSalidaReal = horaAMinutos(hora_salida_real);
        if (minSalidaReal < minIngresoReal) {
            return res.status(400).json({ error: 'La hora de salida real no puede ser anterior a la hora de ingreso real' });
        }

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
            codigo_empleado.trim().toUpperCase(),
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
        console.error('Error al actualizar marcacion:', error);
        return res.status(500).json({ error: 'Error interno al actualizar la marcacion' });
    }
});

// DELETE /api/marcaciones/:id
app.delete('/api/marcaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM marcaciones WHERE id = $1 RETURNING *;', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Marcacion con ID ${id} no encontrada` });
        }

        return res.status(200).json({
            message: `Marcacion con ID ${id} eliminada exitosamente`,
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error al eliminar marcacion:', error);
        return res.status(500).json({ error: 'Error interno al eliminar la marcacion' });
    }
});

//#endregion Rutas

app.listen(port, () => {
    console.log(`===============================================`);
    console.log(`Servidor API REST RRHH iniciado en el puerto ${port}`);
    console.log(`Conectando a base de datos en: ${process.env.DB_HOST || 'database'}:${process.env.DB_PORT || 5432}`);
    console.log(`===============================================`);
    ensureSchema();
});
