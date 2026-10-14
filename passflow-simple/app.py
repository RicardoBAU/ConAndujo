import os
import io
import json
import zipfile
import qrcode
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class UserPass(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')

    if not all([name, email, phone]):
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    folio = f"PASS-{datetime.now().strftime('%y%m%d')}-{os.urandom(2).hex().upper()}"
    
    new_user = UserPass(folio=folio, name=name, email=email, phone=phone)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'success': True, 'folio': folio})

@app.route('/card/<folio>')
def view_card(folio):
    user = UserPass.query.filter_by(folio=folio).first_or_404()
    return render_template('card.html', user=user)

@app.route('/api/pass/<folio>', methods=['GET'])
def generate_pkpass(folio):
    user = UserPass.query.filter_by(folio=folio).first_or_404()
    
    pass_json = {
        "formatVersion": 1,
        "passTypeIdentifier": "pass.com.tarjeta.digital",
        "teamIdentifier": "ABCD1234EF",
        "organizationName": "Mi Negocio",
        "description": "Tarjeta de Identificación Digital",
        "logoText": "Mi Credencial",
        "foregroundColor": "rgb(255, 255, 255)",
        "backgroundColor": "rgb(120, 20, 30)",
        "labelColor": "rgb(200, 200, 200)",
        "serialNumber": user.folio,
        "barcode": {
            "format": "PKBarcodeFormatQR",
            "message": user.folio,
            "messageEncoding": "iso-8859-1"
        },
        "generic": {
            "primaryFields": [{"key": "name", "label": "NOMBRE", "value": user.name}],
            "secondaryFields": [{"key": "folio", "label": "FOLIO", "value": user.folio}]
        }
    }

    qr = qrcode.QRCode(box_size=10, border=2)
    qr.add_data(user.folio)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color="black", back_color="white")
    qr_io = io.BytesIO()
    img_qr.save(qr_io, 'PNG')
    qr_io.seek(0)

    pass_io = io.BytesIO()
    with zipfile.ZipFile(pass_io, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('pass.json', json.dumps(pass_json, indent=2))
        zf.writestr('qrcode.png', qr_io.read())
    
    pass_io.seek(0)
    return send_file(
        pass_io,
        mimetype='application/vnd.apple.pkpass',
        as_attachment=True,
        download_name=f'Tarjeta_{user.folio}.pkpass'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)