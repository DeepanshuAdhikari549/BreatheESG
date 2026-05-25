#!/usr/bin/env bash
set -o errexit

python manage.py migrate
python seed.py
gunicorn config.wsgi:application
