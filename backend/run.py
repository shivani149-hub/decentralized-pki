import sys
import os
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
os.environ["PYTHONPATH"] = str(backend_dir)

from app import create_app

app = create_app()

if __name__ == "__main__":
    print("Starting Decentralized PKI Backend on http://127.0.0.1:5000 ...")
    app.run(host="127.0.0.1", port=5000, debug=False)
