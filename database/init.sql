-- Secuencia para generacion automatica de codigos EMP00X
CREATE SEQUENCE IF NOT EXISTS empleado_seq START WITH 5;

-- Tabla de empleados
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

-- Insercion de empleados iniciales
INSERT INTO empleados (id, codigo_empleado, nombre_completo, cargo, departamento) VALUES
(1, 'EMP001', 'Ana Perez', 'Analista de Sistemas', 'Tecnologia'),
(2, 'EMP002', 'Carlos Mendoza', 'Contador General', 'Finanzas'),
(3, 'EMP003', 'Valeria Rojas', 'Especialista en RRHH', 'Recursos Humanos'),
(4, 'EMP004', 'Diego Morales', 'Desarrollador Backend', 'Tecnologia')
ON CONFLICT (codigo_empleado) DO NOTHING;

-- Sincronizar secuencia
SELECT setval('empleado_seq', GREATEST(4, (SELECT COALESCE(MAX(id), 0) FROM empleados)));

-- Tabla de marcaciones
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

-- Indices para marcaciones
CREATE INDEX IF NOT EXISTS idx_marcaciones_empleado ON marcaciones(codigo_empleado);
CREATE INDEX IF NOT EXISTS idx_marcaciones_fecha ON marcaciones(fecha);

-- Registros iniciales de prueba para marcaciones
INSERT INTO marcaciones (
    codigo_empleado, nombre_empleado, fecha, 
    hora_ingreso_programada, hora_ingreso_real, 
    hora_salida_programada, hora_salida_real, 
    estado, observacion
) VALUES
('EMP002', 'Carlos Mendoza', '2026-09-22', '08:00', '07:55', '16:00', '16:05', 'PUNTUAL', 'Ingreso normal a tiempo'),
('EMP003', 'Valeria Rojas', '2026-09-22', '08:30', '08:48', '16:30', '16:35', 'ATRASO', 'Trafico en autopista'),
('EMP004', 'Diego Morales', '2026-09-23', '09:00', '08:58', '17:00', '17:10', 'PUNTUAL', 'Llegada sin novedades');
