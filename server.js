const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de PostgreSQL (Usa la variable de entorno de Render/Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error al conectar a la base de datos PostgreSQL', err.stack);
    } else {
        console.log('Conectado a la base de datos PostgreSQL.');
        release();
    }
});

// Crear tabla de tarjetas si no existe
const crearTabla = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS tarjetas (
            id TEXT PRIMARY KEY,
            cliente_nombre TEXT NOT NULL,
            cliente_correo TEXT,
            tipo_promocion TEXT NOT NULL,
            valor TEXT NOT NULL,
            estado TEXT DEFAULT 'activa',
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_uso TIMESTAMP
        )`);
        console.log('Tabla "tarjetas" verificada correctamente.');
    } catch (err) {
        console.error('Error al crear la tabla:', err);
    }
};
crearTabla();

// Ruta 1: Crear tarjeta / registrar cliente
app.post('/api/tarjetas', async (req, res) => {
    const { cliente_nombre, cliente_correo, tipo_promocion, valor } = req.body;
    if (!cliente_nombre || !tipo_promocion || !valor) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const id = 'CARD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const query = `INSERT INTO tarjetas (id, cliente_nombre, cliente_correo, tipo_promocion, valor) VALUES ($1, $2, $3, $4, $5)`;
    
    try {
        await pool.query(query, [id, cliente_nombre, cliente_correo, tipo_promocion, valor]);
        res.json({ success: true, id, mensaje: 'Tarjeta creada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ruta 2: Consultar detalles de una tarjeta por ID/QR
app.get('/api/tarjetas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM tarjetas WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tarjeta no encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ruta 3: Canjear / Usar tarjeta en caja
app.post('/api/tarjetas/canjear', async (req, res) => {
    const { id } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM tarjetas WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tarjeta no encontrada' });
        
        const row = result.rows[0];
        if (row.estado === 'usada') {
            return res.status(400).json({ error: 'Esta tarjeta ya fue utilizada anteriormente.' });
        }

        await pool.query(`UPDATE tarjetas SET estado = 'usada', fecha_uso = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        res.json({ success: true, mensaje: '¡Tarjeta canjeada con éxito!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});