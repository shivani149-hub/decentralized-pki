import os
from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from app.config import Config
from app.models import init_db

def create_app(config_class=Config):
    frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    
    app = Flask(
        __name__,
        static_folder=str(frontend_dist) if frontend_dist.exists() else None,
        static_url_path="/"
    )
    app.config.from_object(config_class)

    # Enable CORS for local Vite development frontend
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize SQLite database tables
    with app.app_context():
        init_db()

    # Register Blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.dashboard_routes import dashboard_bp
    from app.routes.cert_routes import cert_bp
    from app.routes.verify_routes import verify_bp
    from app.routes.revocation_routes import revocation_bp
    from app.routes.audit_routes import audit_bp
    from app.routes.trust_routes import trust_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(cert_bp)
    app.register_blueprint(verify_bp)
    app.register_blueprint(revocation_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(trust_bp)

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "HEALTHY", "service": "Decentralized PKI Framework API"})

    # SPA fallback route to serve frontend bundle
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if frontend_dist.exists():
            file_path = frontend_dist / path
            if path and file_path.exists() and not file_path.is_dir():
                return send_from_directory(str(frontend_dist), path)
            return send_from_directory(str(frontend_dist), "index.html")
        return jsonify({
            "message": "Decentralized PKI Backend active. Frontend build not found. Run 'npm run dev' or 'npm run build' in frontend directory."
        })

    return app
