-- Extensión para generar UUIDs (necesaria para gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Limpieza de tablas existentes (orden inverso para respetar foreign keys)
DROP TABLE IF EXISTS medical_history;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS appointment_status;
DROP TYPE IF EXISTS user_role;

-- Creación de Tipos ENUM
CREATE TYPE user_role AS ENUM ('admin', 'medico', 'enfermero', 'recepcionista');
CREATE TYPE appointment_status AS ENUM ('pendiente', 'completada', 'cancelada', 'ausente');

-- Tabla de Usuarios (Profesionales y Staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- En producción usar bcrypt
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    specialty VARCHAR(100), -- Solo para médicos
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Pacientes
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Citas
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES users(id),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status appointment_status DEFAULT 'pendiente',
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Historial Médico
CREATE TABLE medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES users(id),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT NOT NULL
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_professional ON appointments(professional_id);
CREATE INDEX idx_history_patient ON medical_history(patient_id);

-- SEEDS (Datos de prueba)

-- 1. Usuarios
INSERT INTO users (full_name, email, password_hash, role, specialty) VALUES
('Dr. Alejandro Ruiz', 'admin@medcore.com', '123456', 'admin', NULL),
('Dra. Sofia Lopez', 'doctor@medcore.com', '123456', 'medico', 'Cardiología'),
('Enf. Carla Perez', 'nurse@medcore.com', '123456', 'enfermero', NULL),
('Recep. Juan Garcia', 'reception@medcore.com', '123456', 'recepcionista', NULL);

-- 2. Pacientes
INSERT INTO patients (dni, first_name, last_name, birth_date, phone, email, address) VALUES
('12345678A', 'Roberto', 'Gomez', '1980-05-15', '555-0101', 'roberto@example.com', 'Calle Falsa 123'),
('87654321B', 'Maria', 'Rodriguez', '1992-11-20', '555-0102', 'maria@example.com', 'Av. Libertad 45'),
('11223344C', 'Carlos', 'Sanchez', '1955-03-10', '555-0103', 'carlos@example.com', 'Plaza Mayor 1');

-- 3. Citas
INSERT INTO appointments (patient_id, professional_id, date, status, reason)
VALUES (
    (SELECT id FROM patients WHERE dni = '12345678A'),
    (SELECT id FROM users WHERE email = 'doctor@medcore.com'),
    NOW() + INTERVAL '1 day',
    'pendiente',
    'Revisión cardiológica'
);

INSERT INTO appointments (patient_id, professional_id, date, status, reason)
VALUES (
    (SELECT id FROM patients WHERE dni = '87654321B'),
    (SELECT id FROM users WHERE email = 'doctor@medcore.com'),
    NOW() + INTERVAL '2 days',
    'pendiente',
    'Dolor de pecho'
);

INSERT INTO appointments (patient_id, professional_id, date, status, reason, notes)
VALUES (
    (SELECT id FROM patients WHERE dni = '12345678A'),
    (SELECT id FROM users WHERE email = 'doctor@medcore.com'),
    NOW() - INTERVAL '5 days',
    'completada',
    'Primera visita',
    'Paciente presenta hipertensión leve.'
);

-- 4. Historial Médico
INSERT INTO medical_history (patient_id, professional_id, date, description)
VALUES (
    (SELECT id FROM patients WHERE dni = '12345678A'),
    (SELECT id FROM users WHERE email = 'doctor@medcore.com'),
    NOW() - INTERVAL '5 days',
    'Paciente acude por fatiga. Se solicitan análisis de sangre.'
);

INSERT INTO medical_history (patient_id, professional_id, date, description)
VALUES (
    (SELECT id FROM patients WHERE dni = '12345678A'),
    (SELECT id FROM users WHERE email = 'doctor@medcore.com'),
    NOW() - INTERVAL '1 day',
    'Resultados de análisis normales. Se recomienda dieta baja en sodio.'
);
