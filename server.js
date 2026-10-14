const express = require('express');
const { PKPass } = require('passkit-generator');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para generar y descargar el pase de Apple Wallet (.pkpass)
app.post('/api/generate-apple-pass', async (req, res) => {
    const { cliente_nombre, id_tarjeta } = req.body;

    try {
        // Inicializar el pase con el modelo base
        const pass = await PKPass.from({
            model: path.join(__dirname, './pass-model.pass'), // Carpeta con los assets (logo, icon)
            certificates: {
                wwdr: fs.readFileSync('./certs/wwdr.pem'),
                signerCert: fs.readFileSync('./certs/signerCert.pem'),
                signerKey: fs.readFileSync('./certs/signerKey.pem'),
                signerKeyPassphrase: 'tu_password_de_certificado'
            }
        });

        // Configurar campos dinámicos
        pass.primaryFields.add({
            key: 'member',
            label: 'NOMBRE',
            value: cliente_nombre
        });

        // Asignar el código QR con el folio único
        pass.setBarcodes({
            format: 'PKBarcodeFormatQR',
            message: id_tarjeta,
            messageEncoding: 'iso-8859-1'
        });

        // Generar el buffer del archivo .pkpass
        const passBuffer = pass.asBuffer();

        // Enviar respuesta con el MIME type correcto para iOS
        res.set({
            'Content-Type': 'application/vnd.apple.pkpass',
            'Content-Disposition': `attachment; filename="ConAndujo-${id_tarjeta}.pkpass"`
        });

        res.send(passBuffer);

    } catch (error) {
        console.error('Error generando Apple Pass:', error);
        res.status(500).json({ error: 'No se pudo generar el pase nativo' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));