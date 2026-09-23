-- Script de Inicialización de Base de Datos para el Sistema de Marcaciones de RRHH
-- Universidad del Valle - Examen Práctico Cloud Computing

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

-- Índices para optimizar las consultas por empleado y fecha
CREATE INDEX IF NOT EXISTS idx_marcaciones_empleado ON marcaciones(codigo_empleado);
CREATE INDEX IF NOT EXISTS idx_marcaciones_fecha ON marcaciones(fecha);

-- Registros de demostración iniciales
INSERT INTO marcaciones (
    codigo_empleado, nombre_empleado, fecha, 
    hora_ingreso_programada, hora_ingreso_real, 
    hora_salida_programada, hora_salida_real, 
    estado, observacion
) VALUES
('EMP002', 'Carlos Mendoza', '2026-09-22', '08:00', '07:55', '16:00', '16:05', 'PUNTUAL', 'Ingreso normal a tiempo'),
('EMP003', 'Valeria Rojas', '2026-09-22', '08:30', '08:48', '16:30', '16:35', 'ATRASO', 'Tráfico en autopista'),
('EMP004', 'Diego Morales', '2026-09-23', '09:00', '08:58', '17:00', '17:10', 'PUNTUAL', 'Llegada sin novedades');
