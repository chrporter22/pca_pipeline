#!/bin/bash
set -e

# Lock the dependencies
# uv pip compile requirements.txt --output-file requirements.lock.txt
#
# # Install from the locked file
# uv pip install -r requirements.lock.txt

# Run your pipeline (Python script)
python3 ml.py

